import { Effect, Layer, ServiceMap } from "effect";
import type { CollisionBody } from "../../../../src/collision/CollisionWorld.ts";
import type { CameraVector } from "../../../../src/graphics/Camera.ts";
import {
	CollisionWorld,
	DebugOverlay,
	EngineLogger,
	Input,
	type InvalidLogMessageError,
	type OverlayStackUnderflowError,
	roomObjectById,
	SceneDirector,
	type SceneNotFoundError,
	type SceneStackEmptyError,
	Script,
	type UnknownAudioCueError,
	type UnknownInputActionError,
	type WrongAudioCueKindError,
} from "../../../../src/index.ts";
import type { MapValidationError } from "../../../../src/maps/MapError.ts";
import { BeaconRunRoomState } from "../state/BeaconRunRoomState.ts";
import { ExpeditionState } from "../state/ExpeditionState.ts";
import { ScoutState } from "../state/ScoutState.ts";

const movementStep = 8;
const scoutBodyId = "beacon-run-scout";
const exitBodyId = "beacon-run-exit";
const beaconBodyId = "beacon-run-beacon";

const aabbBody = (
	id: string,
	group: string,
	position: CameraVector,
	size: { readonly height: number; readonly width: number },
	isTrigger = true,
): CollisionBody => ({
	group,
	id,
	isTrigger,
	mask: ["player"],
	shape: {
		kind: "aabb",
		shape: {
			height: size.height,
			width: size.width,
			x: position.x,
			y: position.y,
		},
	},
});

type BeaconRunGameplayDirectorFailure =
	| InvalidLogMessageError
	| MapValidationError
	| OverlayStackUnderflowError
	| SceneNotFoundError
	| SceneStackEmptyError
	| UnknownAudioCueError
	| UnknownInputActionError
	| WrongAudioCueKindError;

export class BeaconRunGameplayDirector extends ServiceMap.Service<
	BeaconRunGameplayDirector,
	{
		readonly stepFrame: () => Effect.Effect<
			void,
			BeaconRunGameplayDirectorFailure
		>;
	}
>()("effect2d/games/beacon-run/game/directors/BeaconRunGameplayDirector") {
	static readonly layer = Layer.effect(
		BeaconRunGameplayDirector,
		Effect.gen(function* () {
			const beaconRunRoomState = yield* BeaconRunRoomState;
			const collisionWorld = yield* CollisionWorld;
			const debugOverlay = yield* DebugOverlay;
			const engineLogger = yield* EngineLogger;
			const expeditionState = yield* ExpeditionState;
			const input = yield* Input;
			const sceneDirector = yield* SceneDirector;
			const script = yield* Script;
			const scoutState = yield* ScoutState;

			const scoutShape = Effect.fn("BeaconRunGameplayDirector.scoutShape")(
				function* () {
					const scoutSnapshot = yield* scoutState.snapshot;
					return {
						kind: "aabb" as const,
						shape: {
							height: 16,
							width: 16,
							x: scoutSnapshot.position.x,
							y: scoutSnapshot.position.y,
						},
					};
				},
			);

			const syncCollisionBodies = Effect.fn(
				"BeaconRunGameplayDirector.syncCollisionBodies",
			)(function* () {
				const currentRoom = yield* beaconRunRoomState.snapshot;
				const expeditionSnapshot = yield* expeditionState.snapshot;
				const scoutSnapshot = yield* scoutState.snapshot;
				const exitZone = roomObjectById(currentRoom, "to-shrine-room");
				const beacon = roomObjectById(currentRoom, "north-beacon");

				const bodies: Array<CollisionBody> = [
					aabbBody(
						scoutBodyId,
						"player",
						scoutSnapshot.position,
						{ height: 16, width: 16 },
						false,
					),
				];

				if (exitZone !== undefined) {
					bodies.push(
						aabbBody(
							exitBodyId,
							"room-exit",
							{ x: exitZone.x, y: exitZone.y },
							{ height: exitZone.height, width: exitZone.width },
						),
					);
				}

				if (
					beacon !== undefined &&
					!expeditionSnapshot.litBeaconIds.includes("north-beacon")
				) {
					bodies.push(
						aabbBody(
							beaconBodyId,
							"beacon",
							{ x: beacon.x, y: beacon.y },
							{ height: beacon.height, width: beacon.width },
						),
					);
				}

				for (const bodyId of [scoutBodyId, exitBodyId, beaconBodyId]) {
					yield* collisionWorld.removeBody(bodyId);
				}

				for (const body of bodies) {
					yield* collisionWorld.registerBody(body);
				}

				yield* debugOverlay.setCollisionBodies(bodies);
			});

			const applyMovement = Effect.fn(
				"BeaconRunGameplayDirector.applyMovement",
			)(function* () {
				const directions = [
					{
						action: "move-left",
						delta: { x: -movementStep, y: 0 },
						facing: "left" as const,
					},
					{
						action: "move-right",
						delta: { x: movementStep, y: 0 },
						facing: "right" as const,
					},
					{
						action: "move-up",
						delta: { x: 0, y: -movementStep },
						facing: "up" as const,
					},
					{
						action: "move-down",
						delta: { x: 0, y: movementStep },
						facing: "down" as const,
					},
				] as const;

				for (const direction of directions) {
					const actionState = yield* input.actionState(direction.action);
					if (!actionState.isPressed) {
						continue;
					}

					yield* scoutState.setFacing(direction.facing);
					yield* scoutState.moveBy(direction.delta);
				}
			});

			const handleInteraction = Effect.fn(
				"BeaconRunGameplayDirector.handleInteraction",
			)(function* () {
				const interact = yield* input.actionState("interact");
				if (!interact.justPressed) {
					return;
				}

				const expeditionSnapshot = yield* expeditionState.snapshot;
				const overlappingBodies = yield* collisionWorld.queryTriggers(
					yield* scoutShape(),
					["beacon"],
				);
				if (
					expeditionSnapshot.currentRoomId === "shrine-room" &&
					overlappingBodies.some((body) => body.id === beaconBodyId)
				) {
					yield* expeditionState.lightBeacon("north-beacon");
					yield* script.playSoundCue("beacon-ignite");
					yield* engineLogger.info("Beacon Run beacon lit.", {
						beaconId: "north-beacon",
					});
					yield* input.consumeAction("interact");
					yield* syncCollisionBodies();
				}
			});

			const stepFrame = Effect.fn("BeaconRunGameplayDirector.stepFrame")(
				function* () {
					const activeSceneId = (yield* sceneDirector.snapshot).activeSceneId;
					const cancelAction = yield* input.actionState("menu-cancel");
					const confirmAction = yield* input.actionState("menu-confirm");
					const debugToggle = yield* input.actionState("debug-toggle");

					if (activeSceneId === "title") {
						if (confirmAction.justPressed) {
							yield* script.playSoundCue("menu-confirm");
							yield* script.switchScene("field");
						}
						return;
					}

					if (activeSceneId === "pause") {
						if (cancelAction.justPressed || confirmAction.justPressed) {
							yield* script.playSoundCue("pause-toggle");
							yield* script.popOverlayScene();
						}
						return;
					}

					if (cancelAction.justPressed) {
						yield* script.playSoundCue("pause-toggle");
						yield* script.pushOverlayScene("pause");
						return;
					}

					if (debugToggle.justPressed) {
						yield* debugOverlay.toggle;
						yield* input.consumeAction("debug-toggle");
					}

					yield* applyMovement();
					yield* syncCollisionBodies();

					const exitTriggers = yield* collisionWorld.queryTriggers(
						yield* scoutShape(),
						["room-exit"],
					);
					if (exitTriggers.some((body) => body.id === exitBodyId)) {
						yield* beaconRunRoomState.enterRoom("shrine-room");
						const shrineEntry =
							yield* beaconRunRoomState.currentObjectById("shrine-entry");
						yield* scoutState.moveTo({
							x: shrineEntry.x,
							y: shrineEntry.y,
						});
						yield* script.playSoundCue("room-transition");
						yield* engineLogger.info("Beacon Run room transition completed.", {
							roomId: "shrine-room",
						});
						yield* syncCollisionBodies();
					}

					yield* handleInteraction();
				},
			);

			return BeaconRunGameplayDirector.of({
				stepFrame,
			});
		}),
	);
}
