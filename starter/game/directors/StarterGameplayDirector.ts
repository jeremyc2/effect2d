import { Effect, Layer, ServiceMap } from "effect";
import type { CameraVector } from "../../../src/graphics/Camera.ts";
import {
	DebugOverlay,
	EngineLogger,
	Input,
	type InvalidLogMessageError,
	type InvalidScriptWaitError,
	Script,
	ScriptEvents,
	type UnknownFontError,
	type UnknownInputActionError,
} from "../../../src/index.ts";
import { GameplayState } from "../state/GameplayState.ts";
import { PlayerState } from "../state/PlayerState.ts";
import { WorldState } from "../state/WorldState.ts";

const movementStep = 8;
const overworldExitThreshold = 96;
const lanternPickupPosition: CameraVector = { x: 24, y: 32 };

const isNear = (
	left: CameraVector,
	right: CameraVector,
	threshold: number,
): boolean =>
	Math.abs(left.x - right.x) <= threshold &&
	Math.abs(left.y - right.y) <= threshold;

type StarterGameplayDirectorFailure =
	| InvalidLogMessageError
	| InvalidScriptWaitError
	| UnknownFontError
	| UnknownInputActionError;

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
			const debugOverlay = yield* DebugOverlay;
			const engineLogger = yield* EngineLogger;
			const gameplayState = yield* GameplayState;
			const input = yield* Input;
			const playerState = yield* PlayerState;
			const script = yield* Script;
			const scriptEvents = yield* ScriptEvents;
			const worldState = yield* WorldState;

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

				const gameplaySnapshot = yield* gameplayState.snapshot;
				const playerSnapshot = yield* playerState.snapshot;
				const worldSnapshot = yield* worldState.snapshot;

				if (
					worldSnapshot.currentRoomId === "lantern-room" &&
					!gameplaySnapshot.lanternPickupCollected &&
					isNear(playerSnapshot.position, lanternPickupPosition, 12)
				) {
					yield* gameplayState.collectLantern;
					yield* worldState.lightLantern;
					yield* worldState.addItem("lantern");
					yield* scriptEvents.publish({
						pickupId: "lantern",
						type: "pickup-collected",
					});
					yield* engineLogger.info("Starter lantern collected.", {
						roomId: worldSnapshot.currentRoomId,
					});
					yield* input.consumeAction("interact");
					return;
				}

				if (
					worldSnapshot.lanternLit &&
					!gameplaySnapshot.enemyDefeated &&
					isNear(playerSnapshot.position, gameplaySnapshot.enemyPosition, 16)
				) {
					yield* gameplayState.defeatEnemy;
					yield* scriptEvents.publish({
						enemyId: "slime",
						type: "enemy-defeated",
					});
					yield* engineLogger.info("Starter enemy defeated.", {
						enemyId: "slime",
					});
					yield* input.consumeAction("interact");
				}
			});

			const stepFrame = Effect.fn("StarterGameplayDirector.stepFrame")(
				function* () {
					const debugToggle = yield* input.actionState("debug-toggle");
					if (debugToggle.justPressed) {
						yield* debugOverlay.toggle;
						yield* input.consumeAction("debug-toggle");
					}

					yield* applyMovement();

					const playerSnapshot = yield* playerState.snapshot;
					const worldSnapshot = yield* worldState.snapshot;

					if (
						worldSnapshot.currentRoomId === "overworld-room" &&
						playerSnapshot.position.x >= overworldExitThreshold
					) {
						yield* worldState.enterRoom("lantern-room");
						yield* playerState.restore({
							...playerSnapshot,
							position: {
								x: 8,
								y: 32,
							},
						});
						yield* engineLogger.info("Starter room transition completed.", {
							roomId: "lantern-room",
						});
					}

					const nextWorldSnapshot = yield* worldState.snapshot;
					if (nextWorldSnapshot.currentRoomId === "lantern-room") {
						yield* runIntroSequence();
						yield* gameplayState.moveEnemyToward(
							(yield* playerState.snapshot).position,
							4,
						);
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
