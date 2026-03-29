import { Effect, Layer, ServiceMap } from "effect";
import {
	Audio,
	EngineLogger,
	Input,
	type InvalidLogMessageError,
	RuntimeClock,
	SceneCamera,
	SceneDirector,
	type SceneNotFoundError,
	type SceneStackEmptyError,
	type UnknownAudioCueError,
	type UnknownInputActionError,
	type WrongAudioCueKindError,
} from "../../../../src/index.ts";
import { cavernMenuButtons } from "../content/CavernMenu.ts";
import {
	cavernCameraZoom,
	cavernViewport,
	doesRectangleIntersect,
	getCavernRoom,
	getPlayerVisualCenter,
	getRoomCameraBounds,
	getTransitionSpawnPosition,
} from "../content/CavernWorld.ts";
import { CavernMenuState } from "../state/CavernMenuState.ts";
import { CavernPlayerState } from "../state/CavernPlayerState.ts";
import { CavernWorldState } from "../state/CavernWorldState.ts";

const playerSize = {
	height: 192,
	width: 80,
} as const;
// Increase this to accelerate faster when holding a direction, or lower it to make movement feel heavier.
const accelerationPerFrame = 2.2;
// Increase this to raise the player's top speed, or lower it to cap movement sooner.
const maximumSpeedPerFrame = 40;
// Increase this to keep more momentum while coasting, or lower it to make the player slow down faster when idle.
const idleDragFactor = 0.92;
// Increase this to preserve more speed while changing direction, or lower it to make turns and braking feel sharper.
const brakingDragFactor = 0.99;
// Increase this to stop tiny leftover motion sooner, or lower it to allow longer low-speed drift.
const minimumVelocityMagnitude = 0.1;

function clampValue(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function getVectorMagnitude(vector: {
	readonly x: number;
	readonly y: number;
}): number {
	return Math.hypot(vector.x, vector.y);
}

function clampVectorMagnitude(
	vector: { readonly x: number; readonly y: number },
	maximumMagnitude: number,
): {
	readonly x: number;
	readonly y: number;
} {
	const magnitude = getVectorMagnitude(vector);
	if (magnitude <= maximumMagnitude || magnitude === 0) {
		return vector;
	}

	const scale = maximumMagnitude / magnitude;
	return {
		x: vector.x * scale,
		y: vector.y * scale,
	};
}

function applyDrag(
	vector: { readonly x: number; readonly y: number },
	dragFactor: number,
): {
	readonly x: number;
	readonly y: number;
} {
	const slowed = {
		x: vector.x * dragFactor,
		y: vector.y * dragFactor,
	};
	return getVectorMagnitude(slowed) < minimumVelocityMagnitude
		? { x: 0, y: 0 }
		: slowed;
}

const isPointInsideButton = (
	x: number,
	y: number,
	button: (typeof cavernMenuButtons)[number],
): boolean =>
	x >= button.x &&
	x <= button.x + button.width &&
	y >= button.y &&
	y <= button.y + button.height;

type CavernGameplayDirectorFailure =
	| InvalidLogMessageError
	| SceneNotFoundError
	| SceneStackEmptyError
	| UnknownAudioCueError
	| UnknownInputActionError
	| WrongAudioCueKindError;

export class CavernGameplayDirector extends ServiceMap.Service<
	CavernGameplayDirector,
	{
		readonly stepFrame: () => Effect.Effect<
			void,
			CavernGameplayDirectorFailure
		>;
	}
>()("effect2d/games/cavern/game/directors/CavernGameplayDirector") {
	static readonly layer = Layer.effect(
		CavernGameplayDirector,
		Effect.gen(function* () {
			const audio = yield* Audio;
			const cavernMenuState = yield* CavernMenuState;
			const cavernPlayerState = yield* CavernPlayerState;
			const cavernWorldState = yield* CavernWorldState;
			const engineLogger = yield* EngineLogger;
			const input = yield* Input;
			const runtimeClock = yield* RuntimeClock;
			const sceneCamera = yield* SceneCamera;
			const sceneDirector = yield* SceneDirector;

			const activateMenuButton = Effect.fn(
				"CavernGameplayDirector.activateMenuButton",
			)(function* (index: number) {
				const button = cavernMenuButtons[index];
				if (button === undefined) {
					return;
				}
				yield* Effect.annotateCurrentSpan({
					"effect2d.game.menu_button_id": button.id,
					"effect2d.game.menu_index": index,
				});

				yield* audio.playSfx("menu-click");

				switch (button.id) {
					case "new-game":
					case "continue":
						yield* cavernWorldState.reset;
						yield* cavernPlayerState.moveTo(getCavernRoom("rm1").playerSpawn);
						yield* sceneDirector.switchTo("overworld");
						yield* engineLogger.info("Cavern menu advanced to overworld.", {
							action: button.id,
						});
						return;
					case "sound": {
						yield* cavernMenuState.toggleSound;
						const menuSnapshot = yield* cavernMenuState.snapshot;
						if (menuSnapshot.soundOn) {
							yield* audio.playMusic("cavern-menu", { loop: true });
						} else {
							yield* audio.stopMusic;
						}
						return;
					}
					case "github":
						yield* engineLogger.info(
							"Cavern GitHub button selected in native port.",
							{
								note: "System URL opening is not implemented in the engine yet.",
							},
						);
				}
			});

			const updateMenuSelection = Effect.fn(
				"CavernGameplayDirector.updateMenuSelection",
			)(function* () {
				const pointer = yield* input.pointerPosition;
				const hoveredIndex = cavernMenuButtons.findIndex((button) =>
					isPointInsideButton(pointer.x, pointer.y, button),
				);
				const menuSnapshot = yield* cavernMenuState.snapshot;
				const nextHoveredIndex = hoveredIndex >= 0 ? hoveredIndex : null;

				yield* cavernMenuState.setHoveredIndex(nextHoveredIndex);

				if (
					nextHoveredIndex !== null &&
					nextHoveredIndex !== menuSnapshot.selectedIndex
				) {
					yield* cavernMenuState.setSelectedIndex(nextHoveredIndex);
				}

				const menuUp = yield* input.actionState("menu-up");
				const menuDown = yield* input.actionState("menu-down");
				if (menuUp.justPressed) {
					yield* cavernMenuState.setSelectedIndex(
						(menuSnapshot.selectedIndex + cavernMenuButtons.length - 1) %
							cavernMenuButtons.length,
					);
				}
				if (menuDown.justPressed) {
					yield* cavernMenuState.setSelectedIndex(
						(menuSnapshot.selectedIndex + 1) % cavernMenuButtons.length,
					);
				}

				const menuConfirm = yield* input.actionState("menu-confirm");
				const menuClick = yield* input.actionState("menu-click");
				if (menuConfirm.justPressed || menuClick.justPressed) {
					const currentMenuSnapshot = yield* cavernMenuState.snapshot;
					yield* activateMenuButton(currentMenuSnapshot.selectedIndex);
				}
			});

			const updateOverworld = Effect.fn(
				"CavernGameplayDirector.updateOverworld",
			)(function* () {
				const cancel = yield* input.actionState("menu-cancel");
				if (cancel.justPressed) {
					yield* sceneDirector.switchTo("main-menu");
					return;
				}

				const worldSnapshot = yield* cavernWorldState.snapshot;
				const currentRoom = getCavernRoom(worldSnapshot.currentRoomId);
				yield* Effect.annotateCurrentSpan({
					"effect2d.game.room_id": currentRoom.id,
				});
				const playerSnapshot = yield* cavernPlayerState.snapshot;
				const moveLeftPressed = (yield* input.actionState("move-left"))
					.isPressed;
				const moveRightPressed = (yield* input.actionState("move-right"))
					.isPressed;
				const moveUpPressed = (yield* input.actionState("move-up")).isPressed;
				const moveDownPressed = (yield* input.actionState("move-down"))
					.isPressed;
				const isTryingToMove =
					moveLeftPressed ||
					moveRightPressed ||
					moveUpPressed ||
					moveDownPressed;
				const inputVector = {
					x: (moveRightPressed ? 1 : 0) - (moveLeftPressed ? 1 : 0),
					y: (moveDownPressed ? 1 : 0) - (moveUpPressed ? 1 : 0),
				};
				const normalizedInputVector = clampVectorMagnitude(inputVector, 1);
				const acceleratedVelocity = {
					x:
						playerSnapshot.velocity.x +
						normalizedInputVector.x * accelerationPerFrame,
					y:
						playerSnapshot.velocity.y +
						normalizedInputVector.y * accelerationPerFrame,
				};
				const velocityAfterAcceleration = clampVectorMagnitude(
					acceleratedVelocity,
					maximumSpeedPerFrame,
				);
				const nextVelocity = isTryingToMove
					? applyDrag(velocityAfterAcceleration, brakingDragFactor)
					: applyDrag(playerSnapshot.velocity, idleDragFactor);

				if (isTryingToMove) {
					yield* cavernWorldState.beginRoomInstructionsFade(
						yield* runtimeClock.currentTimeMillis,
					);
				}

				const movementMinX = Math.min(
					currentRoom.bounds.x,
					...currentRoom.transitions.map((transition) => transition.x),
				);
				const movementMaxX = Math.max(
					currentRoom.bounds.x + currentRoom.bounds.width - playerSize.width,
					...currentRoom.transitions.map(
						(transition) => transition.x + transition.width - playerSize.width,
					),
				);
				const movementMinY = Math.min(
					currentRoom.bounds.y,
					...currentRoom.transitions.map((transition) => transition.y),
				);
				const movementMaxY = Math.max(
					currentRoom.bounds.y + currentRoom.bounds.height - playerSize.height,
					...currentRoom.transitions.map(
						(transition) =>
							transition.y + transition.height - playerSize.height,
					),
				);

				const candidatePosition = {
					x: clampValue(
						playerSnapshot.position.x + nextVelocity.x,
						movementMinX,
						movementMaxX,
					),
					y: clampValue(
						playerSnapshot.position.y + nextVelocity.y,
						movementMinY,
						movementMaxY,
					),
				};
				yield* cavernPlayerState.moveTo(candidatePosition);
				yield* cavernPlayerState.setVelocity({
					x:
						candidatePosition.x === movementMinX ||
						candidatePosition.x === movementMaxX
							? 0
							: nextVelocity.x,
					y:
						candidatePosition.y === movementMinY ||
						candidatePosition.y === movementMaxY
							? 0
							: nextVelocity.y,
				});

				const playerRectangle = {
					height: playerSize.height,
					width: playerSize.width,
					x: candidatePosition.x,
					y: candidatePosition.y,
				};
				const activeTransition = currentRoom.transitions.find((transition) =>
					doesRectangleIntersect(playerRectangle, transition),
				);

				if (activeTransition !== undefined) {
					yield* Effect.annotateCurrentSpan({
						"effect2d.game.transition_target_room_id":
							activeTransition.targetRoomId,
					});
					const targetRoom = getCavernRoom(activeTransition.targetRoomId);
					yield* cavernWorldState.setCurrentRoom(targetRoom.id);
					yield* cavernPlayerState.moveTo(
						getTransitionSpawnPosition(
							activeTransition,
							targetRoom,
							candidatePosition,
							playerSize,
						),
					);
					yield* cavernPlayerState.setVelocity({ x: 0, y: 0 });
				}

				const updatedPlayerSnapshot = yield* cavernPlayerState.snapshot;
				const updatedWorldSnapshot = yield* cavernWorldState.snapshot;
				const updatedRoom = getCavernRoom(updatedWorldSnapshot.currentRoomId);
				yield* sceneCamera.setViewport(cavernViewport);
				yield* sceneCamera.setZoom(cavernCameraZoom);
				yield* sceneCamera.setBounds(
					getRoomCameraBounds(updatedRoom, cavernViewport, cavernCameraZoom),
				);
				yield* sceneCamera.follow(
					getPlayerVisualCenter(updatedPlayerSnapshot.position, playerSize),
				);
				const deltaSeconds =
					(yield* runtimeClock.snapshot()).lastFrameDeltaMillis / 1_000;
				yield* sceneCamera.step(deltaSeconds);
			});

			const stepFrame = Effect.fn("CavernGameplayDirector.stepFrame")(
				function* () {
					const activeSceneId = (yield* sceneDirector.snapshot).activeSceneId;
					yield* Effect.annotateCurrentSpan({
						"effect2d.game.scene_id": activeSceneId ?? "none",
					});
					if (activeSceneId === "main-menu") {
						yield* updateMenuSelection();
						return;
					}

					yield* updateOverworld();
				},
			);

			return CavernGameplayDirector.of({
				stepFrame,
			});
		}),
	);
}
