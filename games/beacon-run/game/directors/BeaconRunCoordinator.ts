import { Effect, Layer, ServiceMap } from "effect";
import {
	EngineLogger,
	type InvalidLogMessageError,
} from "../../../../src/debug/EngineLogger.ts";
import type { MapValidationError } from "../../../../src/maps/MapError.ts";
import { SequenceEvents } from "../../../../src/sequence/Sequence.ts";
import { BeaconRunRoomState } from "../state/BeaconRunRoomState.ts";
import { ExpeditionState } from "../state/ExpeditionState.ts";
import { ScoutState } from "../state/ScoutState.ts";

type BeaconRunCoordinatorFailure = InvalidLogMessageError | MapValidationError;

export class BeaconRunCoordinator extends ServiceMap.Service<
	BeaconRunCoordinator,
	{
		readonly beginExpedition: Effect.Effect<void, BeaconRunCoordinatorFailure>;
		readonly processEvents: Effect.Effect<void, InvalidLogMessageError>;
		readonly recordSceneChange: (sceneId: string) => Effect.Effect<void>;
	}
>()("effect2d/games/beacon-run/game/directors/BeaconRunCoordinator") {
	static readonly layer = Layer.effect(
		BeaconRunCoordinator,
		Effect.gen(function* () {
			const beaconRunRoomState = yield* BeaconRunRoomState;
			const engineLogger = yield* EngineLogger;
			const expeditionState = yield* ExpeditionState;
			const scoutState = yield* ScoutState;
			const sequenceEvents = yield* SequenceEvents;

			const beginExpedition = Effect.gen(function* () {
				const fieldSpawn = yield* beaconRunRoomState.roomObjectById(
					"field-room",
					"field-spawn",
				);
				yield* scoutState.restore({
					facing: "right",
					position: {
						x: fieldSpawn.x,
						y: fieldSpawn.y,
					},
				});
				yield* expeditionState.restore({
					currentRoomId: "field-room",
					litBeaconIds: [],
					missionComplete: false,
				});
				yield* beaconRunRoomState.enterRoom("field-room");
				yield* engineLogger.info("Beacon Run expedition started.", {
					roomId: "field-room",
				});
			}).pipe(Effect.withSpan("BeaconRunCoordinator.beginExpedition"));

			const processEvents = Effect.gen(function* () {
				const events = yield* sequenceEvents.drain;

				for (const event of events) {
					switch (event.type) {
						case "scene-changed":
							yield* engineLogger.info("Beacon Run scene changed.", {
								sceneId: event.sceneId,
							});
							break;
						case "pickup-collected":
						case "enemy-defeated":
						case "player-damaged":
						case "save-completed":
							break;
					}
				}
			}).pipe(Effect.withSpan("BeaconRunCoordinator.processEvents"));

			const recordSceneChange = Effect.fn(
				"BeaconRunCoordinator.recordSceneChange",
			)(function* (sceneId: string) {
				yield* sequenceEvents.publish({
					sceneId,
					type: "scene-changed",
				});
			});

			return BeaconRunCoordinator.of({
				beginExpedition,
				processEvents,
				recordSceneChange,
			});
		}),
	);
}
