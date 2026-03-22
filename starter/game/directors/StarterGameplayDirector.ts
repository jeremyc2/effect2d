import { Effect, Layer, ServiceMap } from "effect";
import type { CollisionBody } from "../../../src/collision/CollisionWorld.ts";
import type { CameraVector } from "../../../src/graphics/Camera.ts";
import {
	CollisionWorld,
	DebugOverlay,
	EngineLogger,
	Input,
	type InvalidLogMessageError,
	type InvalidScriptWaitError,
	type OverlayStackUnderflowError,
	SceneDirector,
	type SceneNotFoundError,
	type SceneStackEmptyError,
	Script,
	ScriptEvents,
	type UnknownAudioCueError,
	type UnknownFontError,
	type UnknownInputActionError,
	type WrongAudioCueKindError,
} from "../../../src/index.ts";
import type { MapValidationError } from "../../../src/maps/MapError.ts";
import { GameplayState } from "../state/GameplayState.ts";
import { PlayerState } from "../state/PlayerState.ts";
import { RoomState } from "../state/RoomState.ts";
import { WorldState } from "../state/WorldState.ts";

const movementStep = 8;
const playerBodyId = "starter-player";
const exitBodyId = "starter-room-exit";
const lanternBodyId = "starter-lantern";
const enemyBodyId = "starter-slime";

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

type StarterGameplayDirectorFailure =
	| InvalidLogMessageError
	| InvalidScriptWaitError
	| OverlayStackUnderflowError
	| MapValidationError
	| SceneNotFoundError
	| SceneStackEmptyError
	| UnknownAudioCueError
	| UnknownFontError
	| UnknownInputActionError
	| WrongAudioCueKindError;

export class StarterGameplayDirector extends ServiceMap.Service<
	StarterGameplayDirector,
	{
		readonly runIntroSequence: () => Effect.Effect<
			void,
			InvalidLogMessageError | InvalidScriptWaitError | UnknownFontError
		>;
		readonly stepFrame: () => Effect.Effect<
			void,
			StarterGameplayDirectorFailure
		>;
	}
>()("effect2d/starter/game/directors/StarterGameplayDirector") {
	static readonly layer = Layer.effect(
		StarterGameplayDirector,
		Effect.gen(function* () {
			const collisionWorld = yield* CollisionWorld;
			const debugOverlay = yield* DebugOverlay;
			const engineLogger = yield* EngineLogger;
			const gameplayState = yield* GameplayState;
			const input = yield* Input;
			const playerState = yield* PlayerState;
			const roomState = yield* RoomState;
			const sceneDirector = yield* SceneDirector;
			const script = yield* Script;
			const scriptEvents = yield* ScriptEvents;
			const worldState = yield* WorldState;

			const syncCollisionBodies = Effect.fn(
				"StarterGameplayDirector.syncCollisionBodies",
			)(function* () {
				const gameplaySnapshot = yield* gameplayState.snapshot;
				const playerSnapshot = yield* playerState.snapshot;
				const currentRoom = yield* roomState.snapshot;
				const exitZone = currentRoom.objectPlanes
					.flatMap((plane) => plane.entries)
					.find((entry) => entry.id === "to-lantern-room");
				const lanternPickup = currentRoom.objectPlanes
					.flatMap((plane) => plane.entries)
					.find((entry) => entry.id === "lantern-pickup");
				const slimeEnemy = currentRoom.objectPlanes
					.flatMap((plane) => plane.entries)
					.find((entry) => entry.id === "slime-enemy");

				const bodies: Array<CollisionBody> = [
					aabbBody(
						playerBodyId,
						"player",
						playerSnapshot.position,
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
					lanternPickup !== undefined &&
					!gameplaySnapshot.lanternPickupCollected
				) {
					bodies.push(
						aabbBody(
							lanternBodyId,
							"pickup",
							{ x: lanternPickup.x, y: lanternPickup.y },
							{ height: lanternPickup.height, width: lanternPickup.width },
						),
					);
				}

				if (slimeEnemy !== undefined && !gameplaySnapshot.enemyDefeated) {
					bodies.push(
						aabbBody(enemyBodyId, "enemy", gameplaySnapshot.enemyPosition, {
							height: slimeEnemy.height,
							width: slimeEnemy.width,
						}),
					);
				}

				for (const bodyId of [
					playerBodyId,
					exitBodyId,
					lanternBodyId,
					enemyBodyId,
				]) {
					yield* collisionWorld.removeBody(bodyId);
				}

				for (const body of bodies) {
					yield* collisionWorld.registerBody(body);
				}

				yield* debugOverlay.setCollisionBodies(bodies);
				yield* debugOverlay.setRoomMarkers([
					...currentRoom.objectPlanes.flatMap((plane) =>
						plane.entries.map((entry) => ({
							id: entry.id,
							kind: entry.kind,
							position: { x: entry.x, y: entry.y },
						})),
					),
				]);
			});

			const applyMovement = Effect.fn("StarterGameplayDirector.applyMovement")(
				function* () {
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

						yield* playerState.setFacing(direction.facing);
						yield* playerState.moveBy(direction.delta);
					}
				},
			);

			const playerBodyShape = Effect.fn(
				"StarterGameplayDirector.playerBodyShape",
			)(function* () {
				const playerSnapshot = yield* playerState.snapshot;
				return {
					kind: "aabb" as const,
					shape: {
						height: 16,
						width: 16,
						x: playerSnapshot.position.x,
						y: playerSnapshot.position.y,
					},
				};
			});

			const runIntroSequence = Effect.fn(
				"StarterGameplayDirector.runIntroSequence",
			)(function* () {
				const gameplaySnapshot = yield* gameplayState.snapshot;
				if (gameplaySnapshot.introSequencePlayed) {
					return;
				}

				const pages = yield* script.prepareDialogue({
					fontId: "ui-body",
					maxLines: 2,
					maxWidth: 160,
					text: "A lantern flickers in the dark. Press Space to take it.",
				});
				yield* script.waitSteps(1);
				yield* gameplayState.markIntroSequencePlayed;
				yield* engineLogger.info("Starter intro sequence played.", {
					dialoguePageCount: pages.length,
				});
			});

			const handleInteraction = Effect.fn(
				"StarterGameplayDirector.handleInteraction",
			)(function* () {
				const interact = yield* input.actionState("interact");
				if (!interact.justPressed) {
					return;
				}

				const overlappingBodies = yield* collisionWorld.queryTriggers(
					yield* playerBodyShape(),
					["enemy", "pickup"],
				);
				const worldSnapshot = yield* worldState.snapshot;

				if (
					worldSnapshot.currentRoomId === "lantern-room" &&
					overlappingBodies.some((body) => body.id === lanternBodyId)
				) {
					yield* gameplayState.collectLantern;
					yield* worldState.lightLantern;
					yield* worldState.addItem("lantern");
					yield* script.playSoundCue("pickup-lantern");
					yield* scriptEvents.publish({
						pickupId: "lantern",
						type: "pickup-collected",
					});
					yield* engineLogger.info("Starter lantern collected.", {
						roomId: worldSnapshot.currentRoomId,
					});
					yield* input.consumeAction("interact");
					yield* syncCollisionBodies();
					return;
				}

				if (
					worldSnapshot.lanternLit &&
					overlappingBodies.some((body) => body.id === enemyBodyId)
				) {
					yield* gameplayState.defeatEnemy;
					yield* script.playSoundCue("slime-hit");
					yield* scriptEvents.publish({
						enemyId: "slime",
						type: "enemy-defeated",
					});
					yield* engineLogger.info("Starter enemy defeated.", {
						enemyId: "slime",
					});
					yield* input.consumeAction("interact");
					yield* syncCollisionBodies();
				}
			});

			const stepFrame = Effect.fn("StarterGameplayDirector.stepFrame")(
				function* () {
					const activeSceneId = (yield* sceneDirector.snapshot).activeSceneId;
					const cancelAction = yield* input.actionState("menu-cancel");
					const confirmAction = yield* input.actionState("menu-confirm");
					const debugToggle = yield* input.actionState("debug-toggle");

					if (activeSceneId === "main-menu") {
						if (confirmAction.justPressed) {
							yield* script.playSoundCue("menu-confirm");
							yield* script.switchScene("overworld");
						}
						return;
					}

					if (activeSceneId === "pause-overlay") {
						if (cancelAction.justPressed || confirmAction.justPressed) {
							yield* script.playSoundCue("pause-toggle");
							yield* script.popOverlayScene();
						}
						return;
					}

					if (cancelAction.justPressed) {
						yield* script.playSoundCue("pause-toggle");
						yield* script.pushOverlayScene("pause-overlay");
						return;
					}

					if (debugToggle.justPressed) {
						yield* debugOverlay.toggle;
						yield* input.consumeAction("debug-toggle");
					}

					yield* applyMovement();
					yield* syncCollisionBodies();

					const exitTriggers = yield* collisionWorld.queryTriggers(
						yield* playerBodyShape(),
						["room-exit"],
					);
					if (exitTriggers.some((body) => body.id === exitBodyId)) {
						yield* worldState.enterRoom("lantern-room");
						yield* roomState.loadCurrentRoom;
						const lanternEntry =
							yield* roomState.currentObjectById("lantern-entry");
						const playerSnapshot = yield* playerState.snapshot;
						yield* playerState.restore({
							...playerSnapshot,
							position: {
								x: lanternEntry.x,
								y: lanternEntry.y,
							},
						});
						yield* script.playSoundCue("room-transition");
						yield* engineLogger.info("Starter room transition completed.", {
							roomId: "lantern-room",
						});
						yield* syncCollisionBodies();
					}

					if ((yield* worldState.snapshot).currentRoomId === "lantern-room") {
						yield* runIntroSequence();
						yield* gameplayState.moveEnemyToward(
							(yield* playerState.snapshot).position,
							4,
						);
						yield* syncCollisionBodies();
					}

					yield* handleInteraction();
				},
			);

			return StarterGameplayDirector.of({
				runIntroSequence,
				stepFrame,
			});
		}),
	);
}
