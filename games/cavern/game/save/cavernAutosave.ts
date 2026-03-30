import * as Os from "node:os";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import {
	Effect,
	FileSystem,
	Formatter,
	Layer,
	Option,
	Path,
	Result,
	Schema,
	ServiceMap,
} from "effect";
import type * as PlatformError from "effect/PlatformError";
import {
	SaveCoordinator,
	type SaveParticipant,
} from "../../../../src/index.ts";
import { CavernEnemyState } from "../state/CavernEnemyState.ts";
import { CavernPlayerState } from "../state/CavernPlayerState.ts";
import { CavernWorldState } from "../state/CavernWorldState.ts";
import { cavernSaveDir } from "./cavernEnvConfig.ts";
import {
	cavernEnemiesToSaveRecord,
	cavernPlayerToSaveRecord,
	cavernWorldToSaveRecord,
	parseCavernEnemiesSaveRecord,
	parseCavernPlayerSaveRecord,
	parseCavernWorldSaveRecord,
} from "./cavernSaveRecords.ts";

const jsonStringToUnknown = Schema.decodeUnknownEffect(
	Schema.UnknownFromJsonString,
);

/** Persisted Cavern autosave slot id. */
export const cavernAutosaveSlotId = "autosave";

/** Save document version for {@link SaveCoordinator}. */
export const cavernSaveDocumentVersion = 1;

/** Requirements for Cavern save capture/restore (union of state services). @public */
export type CavernSaveR =
	| CavernEnemyState
	| CavernPlayerState
	| CavernWorldState;

const restoreCavernWorld = Effect.fnUntraced(function* (
	state: Readonly<Record<string, unknown>>,
) {
	const parsed = parseCavernWorldSaveRecord(state);
	if (parsed === null) {
		return;
	}
	const world = yield* CavernWorldState;
	yield* world.replaceSnapshot(parsed);
});

const restoreCavernPlayer = Effect.fnUntraced(function* (
	state: Readonly<Record<string, unknown>>,
) {
	const parsed = parseCavernPlayerSaveRecord(state);
	if (parsed === null) {
		return;
	}
	const player = yield* CavernPlayerState;
	yield* player.replaceSnapshot(parsed);
});

const restoreCavernEnemies = Effect.fnUntraced(function* (
	state: Readonly<Record<string, unknown>>,
) {
	const parsed = parseCavernEnemiesSaveRecord(state);
	if (parsed === null) {
		return;
	}
	const enemyState = yield* CavernEnemyState;
	yield* enemyState.setEnemies(parsed);
});

const worldParticipant: SaveParticipant<CavernSaveR> = {
	key: "world",
	capture: Effect.gen(function* () {
		const world = yield* CavernWorldState;
		const snapshot = yield* world.snapshot;
		return cavernWorldToSaveRecord(snapshot);
	}),
	restore: restoreCavernWorld,
};

const playerParticipant: SaveParticipant<CavernSaveR> = {
	key: "player",
	capture: Effect.gen(function* () {
		const player = yield* CavernPlayerState;
		const snapshot = yield* player.snapshot;
		return cavernPlayerToSaveRecord(snapshot);
	}),
	restore: restoreCavernPlayer,
};

const enemiesParticipant: SaveParticipant<CavernSaveR> = {
	key: "enemies",
	capture: Effect.gen(function* () {
		const enemies = yield* CavernEnemyState;
		return cavernEnemiesToSaveRecord(yield* enemies.snapshot);
	}),
	restore: restoreCavernEnemies,
};

const cavernSaveParticipants: ReadonlyArray<SaveParticipant<CavernSaveR>> = [
	worldParticipant,
	playerParticipant,
	enemiesParticipant,
];

export const cavernSaveCoordinatorLayer = SaveCoordinator.layer<CavernSaveR>({
	version: cavernSaveDocumentVersion,
	participants: cavernSaveParticipants,
});

export const cavernPlatformIoLayer = Layer.mergeAll(
	BunFileSystem.layer,
	BunPath.layer,
);

export class CavernDiskSave extends ServiceMap.Service<
	CavernDiskSave,
	{
		readonly flush: () => Effect.Effect<
			void,
			PlatformError.PlatformError,
			never
		>;
		readonly loadFromDisk: () => Effect.Effect<
			void,
			PlatformError.PlatformError,
			never
		>;
	}
>()("effect2d/games/cavern/game/save/cavernAutosave/CavernDiskSave") {
	static readonly layer = Layer.effect(
		CavernDiskSave,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const saveCoordinator = yield* SaveCoordinator;
			const maybeSaveDir = yield* cavernSaveDir;
			const baseDirectory = Option.match(maybeSaveDir, {
				onNone: () => path.join(Os.homedir(), ".effect2d", "saves", "cavern"),
				onSome: (dir) => dir,
			});
			const filePath = path.join(baseDirectory, "save.json");

			const flush = Effect.fn("CavernDiskSave.flush")(function* () {
				const document = yield* saveCoordinator.exportDocument;
				yield* fs.makeDirectory(path.dirname(filePath), {
					recursive: true,
				});
				yield* fs.writeFileString(
					filePath,
					`${Formatter.formatJson(document, { space: 2 })}\n`,
				);
			});

			const loadFromDisk = Effect.fn("CavernDiskSave.loadFromDisk")(
				function* () {
					const exists = yield* fs.exists(filePath);
					if (!exists) {
						return;
					}
					const content = yield* fs.readFileString(filePath);
					const jsonResult = yield* Effect.result(jsonStringToUnknown(content));
					if (Result.isFailure(jsonResult)) {
						yield* Effect.logWarning(
							"Cavern save file was not valid JSON; starting without imported save data.",
						);
						return;
					}
					const importOutcome = yield* Effect.result(
						saveCoordinator.importDocument(jsonResult.success),
					);
					if (Result.isFailure(importOutcome)) {
						yield* Effect.logWarning(
							`Cavern save could not be imported: ${String(importOutcome.failure)}`,
						);
					}
				},
			);

			return CavernDiskSave.of({
				flush,
				loadFromDisk,
			});
		}),
	);
}
