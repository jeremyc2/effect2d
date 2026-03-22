import { Effect, Layer, ServiceMap } from "effect";
import {
	EngineLogger,
	type InvalidLogMessageError,
} from "../../../src/debug/EngineLogger.ts";
import {
	type InvalidResourceRecordError,
	ResourceTracker,
	type UnknownTrackedResourceError,
} from "../../../src/debug/ResourceTracker.ts";
import { ScriptEvents } from "../../../src/script/Script.ts";
import { DebugSettingsState } from "../state/DebugSettingsState.ts";
import { GameplayState } from "../state/GameplayState.ts";
import { PlayerState } from "../state/PlayerState.ts";
import { WorldState } from "../state/WorldState.ts";

type StarterCoordinatorFailure =
	| InvalidLogMessageError
	| InvalidResourceRecordError
	| UnknownTrackedResourceError;

export class StarterCoordinator extends ServiceMap.Service<
	StarterCoordinator,
	{
		readonly beginNewGame: Effect.Effect<void, StarterCoordinatorFailure>;
		readonly processEvents: Effect.Effect<void, InvalidLogMessageError>;
		readonly recordSaveCompleted: (slotId: string) => Effect.Effect<void>;
		readonly recordSceneChange: (sceneId: string) => Effect.Effect<void>;
	}
>()("effect2d/starter/game/directors/StarterCoordinator") {
	static readonly layer = Layer.effect(
		StarterCoordinator,
		Effect.gen(function* () {
			const debugSettingsState = yield* DebugSettingsState;
			const engineLogger = yield* EngineLogger;
			const gameplayState = yield* GameplayState;
			const playerState = yield* PlayerState;
			const resourceTracker = yield* ResourceTracker;
			const scriptEvents = yield* ScriptEvents;
			const worldState = yield* WorldState;

			const beginNewGame = Effect.gen(function* () {
				yield* playerState.restore({
					facing: "down",
					health: 3,
					position: {
						x: 32,
						y: 32,
					},
				});
				yield* worldState.restore({
					currentRoomId: "overworld-room",
					inventory: ["map"],
					lanternLit: false,
				});
				yield* debugSettingsState.restore({
					debugOverlayEnabled: false,
				});
				yield* gameplayState.restore({
					enemyDefeated: false,
					enemyPosition: {
						x: 72,
						y: 32,
					},
					introSequencePlayed: false,
					lanternPickupCollected: false,
				});
				yield* resourceTracker.register(
					"starter-overworld-room",
					"map",
					"Starter coordinator prepared the opening room.",
				);
				yield* resourceTracker.setLoaded(
					"starter-overworld-room",
					"Starter opening room is active.",
				);
				yield* engineLogger.info("Starter coordinator began a new game.", {
					roomId: "overworld-room",
				});
			});

			const recordSceneChange = Effect.fn(
				"StarterCoordinator.recordSceneChange",
			)(function* (sceneId: string) {
				yield* scriptEvents.publish({
					sceneId,
					type: "scene-changed",
				});
			});

			const recordSaveCompleted = Effect.fn(
				"StarterCoordinator.recordSaveCompleted",
			)(function* (slotId: string) {
				yield* scriptEvents.publish({
					slotId,
					type: "save-completed",
				});
			});

			const processEvents = Effect.gen(function* () {
				const events = yield* scriptEvents.drain;

				for (const event of events) {
					switch (event.type) {
						case "save-completed":
							yield* engineLogger.info("Starter save completed.", {
								slotId: event.slotId,
							});
							break;
						case "scene-changed":
							yield* engineLogger.info("Starter scene changed.", {
								sceneId: event.sceneId,
							});
							break;
						case "enemy-defeated":
						case "pickup-collected":
						case "player-damaged":
							break;
					}
				}
			});

			return StarterCoordinator.of({
				beginNewGame,
				processEvents,
				recordSaveCompleted,
				recordSceneChange,
			});
		}),
	);
}
