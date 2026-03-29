import { Effect, Layer, ServiceMap } from "effect";
import type { CollisionBody } from "../../../../src/collision/CollisionWorld.ts";
import type { CameraVector } from "../../../../src/graphics/Camera.ts";
import {
	CollisionWorld,
	Cutscene,
	DebugOverlay,
	EngineLogger,
	getRoomObjectById,
	Input,
	type InvalidLogMessageError,
	type InvalidSequenceWaitError,
	type OverlayStackUnderflowError,
	SceneDirector,
	type SceneNotFoundError,
	type SceneStackEmptyError,
	Sequence,
	SequenceEvents,
	type UnknownAudioCueError,
	type UnknownFontError,
	type UnknownInputActionError,
	type WrongAudioCueKindError,
} from "../../../../src/index.ts";
import type { MapValidationError } from "../../../../src/maps/MapError.ts";
import { DialogueState } from "../state/DialogueState.ts";
import { GameplayState } from "../state/GameplayState.ts";
import { PlayerState } from "../state/PlayerState.ts";
import { RoomState } from "../state/RoomState.ts";
import { WorldState } from "../state/WorldState.ts";

const movementStep = 8;
const playerBodyId = "starter-player";
const exitBodyId = "starter-room-exit";
const lanternBodyId = "starter-lantern";
const enemyBodyId = "starter-slime";

function createAabbBody(
	id: string,
	group: string,
	position: CameraVector,
	size: { readonly height: number; readonly width: number },
	isTrigger = true,
): CollisionBody {
	return {
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
	};
}

type StarterGameplayDirectorFailure =
	| InvalidLogMessageError
	| InvalidSequenceWaitError
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
			InvalidLogMessageError | InvalidSequenceWaitError | UnknownFontError
		>;
		readonly stepFrame: () => Effect.Effect<
			void,
			StarterGameplayDirectorFailure
		>;
	}
>()("effect2d/games/starter/game/directors/StarterGameplayDirector") {
	static readonly layer = Layer.effect(
		StarterGameplayDirector,
		Effect.gen(function* () {
			const collisionWorld = yield* CollisionWorld;
			const debugOverlay = yield* DebugOverlay;
			const dialogueState = yield* DialogueState;
			const engineLogger = yield* EngineLogger;
			const gameplayState = yield* GameplayState;
			const input = yield* Input;
			const playerState = yield* PlayerState;
			const roomState = yield* RoomState;
			const sceneDirector = yield* SceneDirector;
			const cutscene = yield* Cutscene;
			const sequence = yield* Sequence;
			const sequenceEvents = yield* SequenceEvents;
			const worldState = yield* WorldState;

			const syncCollisionBodies = Effect.fn(
				"StarterGameplayDirector.syncCollisionBodies",
			)(function* () {
				const gameplaySnapshot = yield* gameplayState.snapshot;
				const playerSnapshot = yield* playerState.snapshot;
				const currentRoom = yield* roomState.snapshot;
				const exitZone = getRoomObjectById(currentRoom, "to-lantern-room");
				const lanternPickup = getRoomObjectById(currentRoom, "lantern-pickup");
				const slimeEnemy = getRoomObjectById(currentRoom, "slime-enemy");

				const bodies: Array<CollisionBody> = [
					createAabbBody(
						playerBodyId,
						"player",
						playerSnapshot.position,
						{ height: 16, width: 16 },
						false,
					),
				];

				if (exitZone !== undefined) {
					bodies.push(
						createAabbBody(
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
						createAabbBody(
							lanternBodyId,
							"pickup",
							{ x: lanternPickup.x, y: lanternPickup.y },
							{ height: lanternPickup.height, width: lanternPickup.width },
						),
					);
				}

				if (slimeEnemy !== undefined && !gameplaySnapshot.enemyDefeated) {
					bodies.push(
						createAabbBody(
							enemyBodyId,
							"enemy",
							gameplaySnapshot.enemyPosition,
							{
								height: slimeEnemy.height,
								width: slimeEnemy.width,
							},
						),
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

				const pages = yield* cutscene.prepareDialogue({
					fontId: "ui-body",
					maxLines: 2,
					maxWidth: 160,
					text: "A lantern flickers in the dark. Press Space to take it.",
				});
				yield* Effect.annotateCurrentSpan({
					"effect2d.game.dialogue_id": "lantern-intro",
					"effect2d.game.dialogue_page_count": pages.length,
				});
				yield* dialogueState.open("lantern-intro", pages);
				yield* sequence.waitSteps(1);
				yield* gameplayState.markIntroSequencePlayed;
				yield* engineLogger.info("Starter intro sequence played.", {
					dialoguePageCount: pages.length,
				});
			});

			const handleDialogueAdvance = Effect.fn(
				"StarterGameplayDirector.handleDialogueAdvance",
			)(function* () {
				const dialogueSnapshot = yield* dialogueState.snapshot;
				if (dialogueSnapshot.activeDialogue === null) {
					return false;
				}

				const confirmAction = yield* input.actionState("menu-confirm");
				const interactAction = yield* input.actionState("interact");
				if (!confirmAction.justPressed && !interactAction.justPressed) {
					return true;
				}

				yield* dialogueState.advance;
				yield* input.consumeAction("interact");
				yield* input.consumeAction("menu-confirm");
				return true;
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
					yield* Effect.annotateCurrentSpan({
						"effect2d.game.pickup_id": "lantern",
						"effect2d.game.room_id": worldSnapshot.currentRoomId,
					});
					yield* gameplayState.collectLantern;
					yield* worldState.lightLantern;
					yield* worldState.addItem("lantern");
					yield* sequence.playSoundCue("pickup-lantern");
					yield* dialogueState.open(
						"lantern-picked-up",
						yield* cutscene.prepareDialogue({
							fontId: "ui-body",
							maxLines: 2,
							maxWidth: 160,
							text: "The lantern steadies your path.",
						}),
					);
					yield* sequenceEvents.publish({
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
					yield* Effect.annotateCurrentSpan({
						"effect2d.game.enemy_id": "slime",
						"effect2d.game.room_id": worldSnapshot.currentRoomId,
					});
					yield* gameplayState.defeatEnemy;
					yield* sequence.playSoundCue("slime-hit");
					yield* dialogueState.open(
						"slime-defeated",
						yield* cutscene.prepareDialogue({
							fontId: "ui-body",
							maxLines: 2,
							maxWidth: 160,
							text: "The slime recoils from the light and fades away.",
						}),
					);
					yield* sequenceEvents.publish({
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
					yield* Effect.annotateCurrentSpan({
						"effect2d.game.scene_id": activeSceneId ?? "none",
					});
					const cancelAction = yield* input.actionState("menu-cancel");
					const confirmAction = yield* input.actionState("menu-confirm");
					const debugToggle = yield* input.actionState("debug-toggle");

					if (activeSceneId === "main-menu") {
						if (confirmAction.justPressed) {
							yield* sequence.playSoundCue("menu-confirm");
							yield* sequence.switchScene("overworld");
						}
						return;
					}

					if (activeSceneId === "pause-overlay") {
						if (cancelAction.justPressed || confirmAction.justPressed) {
							yield* sequence.playSoundCue("pause-toggle");
							yield* sequence.popOverlayScene();
						}
						return;
					}

					if (cancelAction.justPressed) {
						yield* sequence.playSoundCue("pause-toggle");
						yield* sequence.pushOverlayScene("pause-overlay");
						return;
					}

					if (debugToggle.justPressed) {
						yield* debugOverlay.toggle;
						yield* input.consumeAction("debug-toggle");
					}

					if (yield* handleDialogueAdvance()) {
						return;
					}

					yield* applyMovement();
					yield* syncCollisionBodies();

					const exitTriggers = yield* collisionWorld.queryTriggers(
						yield* playerBodyShape(),
						["room-exit"],
					);
					if (exitTriggers.some((body) => body.id === exitBodyId)) {
						yield* Effect.annotateCurrentSpan({
							"effect2d.game.room_id": "lantern-room",
							"effect2d.game.transition": "overworld-room->lantern-room",
						});
						yield* roomState.enterRoom("lantern-room");
						yield* dialogueState.clear;
						const lanternEntry =
							yield* roomState.currentObjectById("lantern-entry");
						yield* playerState.moveTo({
							x: lanternEntry.x,
							y: lanternEntry.y,
						});
						yield* sequence.playSoundCue("room-transition");
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
