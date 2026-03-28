import { Effect, Layer, Ref, Schema, ServiceMap } from "effect";
import type {
	SaveDocument,
	SaveMigration,
	SaveParticipant,
	SaveSlotDocument,
	SaveSlotId,
} from "./SaveDocument.ts";
import { SaveDocumentSchema } from "./SaveDocument.ts";
import {
	SaveDocumentDecodeError,
	SaveMigrationFailedError,
	SaveMigrationMissingError,
	SaveMigrationVersionMismatchError,
	SaveParticipantKeyConflictError,
	SaveSlotNotFoundError,
} from "./SaveError.ts";

function createDecodeError(error: unknown): SaveDocumentDecodeError {
	return new SaveDocumentDecodeError({
		details: error instanceof Error ? error.message : String(error),
	});
}

const applyMigrations = Effect.fn("SaveCoordinator.applyMigrations")(function* (
	document: SaveDocument,
	targetVersion: number,
	migrations: ReadonlyArray<SaveMigration>,
) {
	let currentDocument = document;

	while (currentDocument.version < targetVersion) {
		const migration = migrations.find(
			(candidate) => candidate.fromVersion === currentDocument.version,
		);
		if (migration === undefined) {
			return yield* new SaveMigrationMissingError({
				fromVersion: currentDocument.version,
				targetVersion,
			});
		}

		currentDocument = yield* migration.migrate(currentDocument).pipe(
			Effect.mapError(
				() =>
					new SaveMigrationFailedError({
						fromVersion: migration.fromVersion,
						toVersion: migration.toVersion,
					}),
			),
		);
	}

	if (currentDocument.version !== targetVersion) {
		return yield* new SaveMigrationVersionMismatchError({
			actualVersion: currentDocument.version,
			expectedVersion: targetVersion,
		});
	}

	return currentDocument;
});

/**
 * Configuration for building a {@link SaveCoordinator}.
 *
 * @public
 *
 * `participants` is the important part: one entry per state area you want to
 * capture and restore. `migrations` is only needed after you start evolving
 * persisted formats across released versions.
 */
export interface SaveCoordinatorOptions {
	readonly initialDocument?: SaveDocument;
	readonly migrations?: ReadonlyArray<SaveMigration>;
	readonly nowMillis?: () => number;
	readonly participants: ReadonlyArray<SaveParticipant>;
	readonly version: number;
}

/**
 * Coordinates save snapshots, restores, imports, and migrations.
 *
 * @public
 *
 * Game authors typically provide a list of {@link SaveParticipant} values, one
 * per domain state area they want to persist. The coordinator handles the
 * boring parts:
 *
 * - composing those participant captures into a single document
 * - restoring participant state from a slot
 * - importing old documents through migrations
 * - exposing typed failures when documents are missing or incompatible
 *
 * ```ts
 * const saveLayer = SaveCoordinator.layer({
 *   version: 1,
 *   participants: [playerSaveParticipant, worldSaveParticipant],
 * });
 * ```
 */
export class SaveCoordinator extends ServiceMap.Service<
	SaveCoordinator,
	{
		readonly restoreSlot: (
			slotId: SaveSlotId,
		) => Effect.Effect<void, SaveSlotNotFoundError>;
		readonly exportDocument: Effect.Effect<SaveDocument>;
		readonly importDocument: (
			document: unknown,
		) => Effect.Effect<
			void,
			| SaveDocumentDecodeError
			| SaveMigrationFailedError
			| SaveMigrationMissingError
			| SaveMigrationVersionMismatchError
		>;
		readonly snapshotSlot: (
			slotId: SaveSlotId,
		) => Effect.Effect<SaveSlotDocument>;
		readonly writeSlot: (slotId: SaveSlotId) => Effect.Effect<SaveDocument>;
	}
>()("effect2d/save/SaveCoordinator") {
	static readonly layer = ({
		initialDocument,
		migrations = [],
		nowMillis = () => Math.round(performance.timeOrigin + performance.now()),
		participants,
		version,
	}: SaveCoordinatorOptions) =>
		Layer.effect(
			SaveCoordinator,
			Effect.gen(function* () {
				const participantKeys = participants.map(
					(participant) => participant.key,
				);
				const duplicateParticipantKey = participantKeys.find(
					(key, index) => participantKeys.indexOf(key) !== index,
				);
				if (duplicateParticipantKey !== undefined) {
					return yield* new SaveParticipantKeyConflictError({
						key: duplicateParticipantKey,
					});
				}

				const documentRef = yield* Ref.make<SaveDocument>(
					initialDocument ?? {
						version,
						slots: {},
					},
				);

				const snapshotSlot = Effect.fn("SaveCoordinator.snapshotSlot")(
					function* (slotId: SaveSlotId) {
						const participantStates: Record<
							string,
							Readonly<Record<string, unknown>>
						> = {};

						for (const participant of participants) {
							participantStates[participant.key] = yield* participant.capture;
						}

						return {
							participantStates,
							savedAtMillis: nowMillis(),
							slotId,
						} satisfies SaveSlotDocument;
					},
				);

				const writeSlot = Effect.fn("SaveCoordinator.writeSlot")(function* (
					slotId: SaveSlotId,
				) {
					const slot = yield* snapshotSlot(slotId);
					const currentDocument = yield* Ref.get(documentRef);
					const nextDocument: SaveDocument = {
						...currentDocument,
						slots: {
							...currentDocument.slots,
							[slotId]: slot,
						},
						version,
					};

					yield* Ref.set(documentRef, nextDocument);
					return nextDocument;
				});

				const restoreSlot = Effect.fn("SaveCoordinator.restoreSlot")(function* (
					slotId: SaveSlotId,
				) {
					const currentDocument = yield* Ref.get(documentRef);
					const slot = currentDocument.slots[slotId];

					if (slot === undefined) {
						return yield* new SaveSlotNotFoundError({ slotId });
					}

					for (const participant of participants) {
						yield* participant.restore(
							slot.participantStates[participant.key] ?? {},
						);
					}
				});

				const importDocument = Effect.fn("SaveCoordinator.importDocument")(
					function* (document: unknown) {
						const decodedDocument = yield* Schema.decodeUnknownEffect(
							SaveDocumentSchema,
						)(document).pipe(Effect.mapError(createDecodeError));
						const migratedDocument =
							decodedDocument.version === version
								? decodedDocument
								: yield* applyMigrations(decodedDocument, version, migrations);

						yield* Ref.set(documentRef, migratedDocument);
					},
				);

				return SaveCoordinator.of({
					exportDocument: Ref.get(documentRef),
					importDocument,
					restoreSlot,
					snapshotSlot,
					writeSlot,
				});
			}),
		);
}
