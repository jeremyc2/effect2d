import { Context, Effect, Layer, Result } from "effect";
import type * as PlatformError from "effect/PlatformError";
import {
	Audio,
	EngineLogger,
	Input,
	type InvalidLogMessageError,
	RuntimeClock,
	SaveCoordinator,
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
	type CavernRectangle,
	cavernCameraZoom,
	cavernViewport,
	doesRectangleIntersect,
	getCavernRoom,
	getPlayerVisualCenter,
	getRoomCameraBounds,
	getTransitionSpawnPosition,
} from "../content/CavernWorld.ts";
import {
	CavernDiskSave,
	cavernAutosaveSlotId,
} from "../save/cavernAutosave.ts";
import { CavernEnemyState } from "../state/CavernEnemyState.ts";
import { CavernMenuState } from "../state/CavernMenuState.ts";
import { CavernPlayerState } from "../state/CavernPlayerState.ts";
import { CavernWorldState } from "../state/CavernWorldState.ts";

const playerSize = {
	height: 192,
	width: 80,
} as const;

const flyerSize = {
	height: 92,
	width: 92,
} as const;

// Increase this to accelerate faster when holding a direction, or lower it to make movement feel heavier.
const accelerationPerFrame = 2.2;
// Increase this to raise the player's top speed, or lower it to cap movement sooner.
const maximumSpeedPerFrame = 40;
// Increase this to make flyers home in faster, or lower it to give the player more breathing room.
const flyerAccelerationPerFrame = 1.2;
// Increase this to make flyers more relentless, or lower it to keep pursuit gentler.
const flyerMaximumSpeedPerFrame = 11;
// Increase this to keep more momentum while coasting, or lower it to make the player slow down faster when idle.
const idleDragFactor = 0.92;
// Increase this to preserve more speed while changing direction, or lower it to make turns and braking feel sharper.
const brakingDragFactor = 0.99;
// Increase this to stop tiny leftover motion sooner, or lower it to allow longer low-speed drift.
const minimumVelocityMagnitude = 0.1;

// Increase this to run more overlap-resolution passes per frame, or lower it to trade collision stability for cheaper updates.
const collisionIterations = 2;
// Increase this to leave more space between bodies after a collision, or lower it to let them settle closer together.
const collisionSeparationPadding = 8;
// Increase this to make all collisions feel punchier, or lower it to make momentum transfer more subdued.
const baseKnockbackVelocityPerFrame = 10;

interface DynamicBodyState {
	readonly id: string;
	readonly position: {
		readonly x: number;
		readonly y: number;
	};
	readonly size: {
		readonly height: number;
		readonly width: number;
	};
	readonly velocity: {
		readonly x: number;
		readonly y: number;
	};
	readonly velocityCap: number;
}

interface BodyMovementBounds {
	readonly maxX: number;
	readonly maxY: number;
	readonly minX: number;
	readonly minY: number;
}

interface AccessibleAreaRoom {
	readonly bounds: CavernRectangle;
	readonly transitions: ReadonlyArray<CavernRectangle>;
}

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

function normalizeVector(
	vector: { readonly x: number; readonly y: number },
	fallback: { readonly x: number; readonly y: number } = { x: 1, y: 0 },
): {
	readonly x: number;
	readonly y: number;
} {
	const magnitude = getVectorMagnitude(vector);
	if (magnitude === 0) {
		return fallback;
	}

	return {
		x: vector.x / magnitude,
		y: vector.y / magnitude,
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

function getRectangleCenter(rectangle: CavernRectangle): {
	readonly x: number;
	readonly y: number;
} {
	return {
		x: rectangle.x + rectangle.width / 2,
		y: rectangle.y + rectangle.height / 2,
	};
}

function makeRectangle(
	position: {
		readonly x: number;
		readonly y: number;
	},
	size: {
		readonly height: number;
		readonly width: number;
	},
): CavernRectangle {
	return {
		height: size.height,
		width: size.width,
		x: position.x,
		y: position.y,
	};
}

function overlapsOnAxis(
	startA: number,
	lengthA: number,
	startB: number,
	lengthB: number,
): boolean {
	return startA < startB + lengthB && startA + lengthA > startB;
}

function getBodyMovementBounds(
	body: {
		readonly position: {
			readonly x: number;
			readonly y: number;
		};
		readonly size: {
			readonly height: number;
			readonly width: number;
		};
	},
	room: AccessibleAreaRoom,
): BodyMovementBounds {
	let minX = room.bounds.x;
	let maxX = room.bounds.x + room.bounds.width - body.size.width;
	let minY = room.bounds.y;
	let maxY = room.bounds.y + room.bounds.height - body.size.height;
	const roomMaxX = room.bounds.x + room.bounds.width;
	const roomMaxY = room.bounds.y + room.bounds.height;

	for (const transition of room.transitions) {
		const overlapsTransitionVertically = overlapsOnAxis(
			body.position.y,
			body.size.height,
			transition.y,
			transition.height,
		);
		const overlapsTransitionHorizontally = overlapsOnAxis(
			body.position.x,
			body.size.width,
			transition.x,
			transition.width,
		);

		if (overlapsTransitionVertically && transition.x <= room.bounds.x) {
			minX = Math.min(minX, transition.x);
		}
		if (
			overlapsTransitionVertically &&
			transition.x + transition.width >= roomMaxX
		) {
			maxX = Math.max(maxX, transition.x + transition.width - body.size.width);
		}
		if (overlapsTransitionHorizontally && transition.y <= room.bounds.y) {
			minY = Math.min(minY, transition.y);
		}
		if (
			overlapsTransitionHorizontally &&
			transition.y + transition.height >= roomMaxY
		) {
			maxY = Math.max(
				maxY,
				transition.y + transition.height - body.size.height,
			);
		}
	}

	return {
		maxX,
		maxY,
		minX,
		minY,
	};
}

function clampBodyToRoom(
	body: DynamicBodyState,
	room: {
		readonly bounds: CavernRectangle;
	},
): DynamicBodyState {
	return clampBodyToMovementBounds(body, {
		maxX: room.bounds.x + room.bounds.width - body.size.width,
		maxY: room.bounds.y + room.bounds.height - body.size.height,
		minX: room.bounds.x,
		minY: room.bounds.y,
	});
}

function clampBodyToMovementBounds(
	body: DynamicBodyState,
	movementBounds: BodyMovementBounds,
): DynamicBodyState {
	const position = {
		x: clampValue(body.position.x, movementBounds.minX, movementBounds.maxX),
		y: clampValue(body.position.y, movementBounds.minY, movementBounds.maxY),
	};

	return {
		...body,
		position,
		velocity: clampVectorMagnitude(body.velocity, body.velocityCap),
	};
}

function clampBodyToAccessibleArea(
	body: DynamicBodyState,
	room: AccessibleAreaRoom,
): DynamicBodyState {
	return clampBodyToMovementBounds(body, getBodyMovementBounds(body, room));
}

function getOverlapDepths(
	left: CavernRectangle,
	right: CavernRectangle,
): {
	readonly x: number;
	readonly y: number;
} {
	return {
		x: Math.min(left.x + left.width - right.x, right.x + right.width - left.x),
		y: Math.min(
			left.y + left.height - right.y,
			right.y + right.height - left.y,
		),
	};
}

function resolveBodyCollision(
	leftBody: DynamicBodyState,
	rightBody: DynamicBodyState,
): {
	readonly leftBody: DynamicBodyState;
	readonly rightBody: DynamicBodyState;
} {
	const leftRectangle = makeRectangle(leftBody.position, leftBody.size);
	const rightRectangle = makeRectangle(rightBody.position, rightBody.size);
	if (!doesRectangleIntersect(leftRectangle, rightRectangle)) {
		return {
			leftBody,
			rightBody,
		};
	}

	const leftCenter = getRectangleCenter(leftRectangle);
	const rightCenter = getRectangleCenter(rightRectangle);
	const awayFromRight = normalizeVector({
		x: leftCenter.x - rightCenter.x,
		y: leftCenter.y - rightCenter.y,
	});
	const overlaps = getOverlapDepths(leftRectangle, rightRectangle);
	const leftSpeed = getVectorMagnitude(leftBody.velocity);
	const rightSpeed = getVectorMagnitude(rightBody.velocity);
	const leftInfluence = 1 + leftSpeed;
	const rightInfluence = 1 + rightSpeed;
	const totalInfluence = leftInfluence + rightInfluence;
	const leftShare = rightInfluence / totalInfluence;
	const rightShare = leftInfluence / totalInfluence;
	const separationDistance =
		(Math.abs(leftCenter.x - rightCenter.x) >=
		Math.abs(leftCenter.y - rightCenter.y)
			? overlaps.x
			: overlaps.y) + collisionSeparationPadding;
	const separationVector = {
		x: awayFromRight.x * separationDistance,
		y: awayFromRight.y * separationDistance,
	};
	const impactVelocity =
		baseKnockbackVelocityPerFrame + Math.abs(leftSpeed - rightSpeed) * 0.5;

	return {
		leftBody: {
			...leftBody,
			position: {
				x: leftBody.position.x + separationVector.x * leftShare,
				y: leftBody.position.y + separationVector.y * leftShare,
			},
			velocity: clampVectorMagnitude(
				{
					x: leftBody.velocity.x + awayFromRight.x * impactVelocity * leftShare,
					y: leftBody.velocity.y + awayFromRight.y * impactVelocity * leftShare,
				},
				leftBody.velocityCap,
			),
		},
		rightBody: {
			...rightBody,
			position: {
				x: rightBody.position.x - separationVector.x * rightShare,
				y: rightBody.position.y - separationVector.y * rightShare,
			},
			velocity: clampVectorMagnitude(
				{
					x:
						rightBody.velocity.x -
						awayFromRight.x * impactVelocity * rightShare,
					y:
						rightBody.velocity.y -
						awayFromRight.y * impactVelocity * rightShare,
				},
				rightBody.velocityCap,
			),
		},
	};
}

function replaceEnemyBody(
	enemyBodies: ReadonlyArray<DynamicBodyState>,
	index: number,
	body: DynamicBodyState,
): ReadonlyArray<DynamicBodyState> {
	return enemyBodies.map((enemyBody, enemyIndex) =>
		enemyIndex === index ? body : enemyBody,
	);
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
	| PlatformError.PlatformError
	| SceneNotFoundError
	| SceneStackEmptyError
	| UnknownAudioCueError
	| UnknownInputActionError
	| WrongAudioCueKindError;

export class CavernGameplayDirector extends Context.Service<
	CavernGameplayDirector,
	{
		readonly stepFrame: Effect.Effect<void, CavernGameplayDirectorFailure>;
	}
>()("effect2d/games/cavern/game/directors/CavernGameplayDirector") {
	static readonly layer = Layer.effect(
		CavernGameplayDirector,
		Effect.gen(function* () {
			const audio = yield* Audio;
			const cavernEnemyState = yield* CavernEnemyState;
			const cavernMenuState = yield* CavernMenuState;
			const cavernPlayerState = yield* CavernPlayerState;
			const cavernWorldState = yield* CavernWorldState;
			const engineLogger = yield* EngineLogger;
			const input = yield* Input;
			const runtimeClock = yield* RuntimeClock;
			const sceneCamera = yield* SceneCamera;
			const sceneDirector = yield* SceneDirector;
			const saveCoordinator = yield* SaveCoordinator;
			const cavernDiskSave = yield* CavernDiskSave;

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
					case "new-game": {
						yield* cavernWorldState.reset;
						yield* cavernEnemyState.reset;
						yield* cavernPlayerState.moveTo(getCavernRoom("rm1").playerSpawn);
						yield* cavernPlayerState.setVelocity({ x: 0, y: 0 });
						yield* saveCoordinator.writeSlot(cavernAutosaveSlotId);
						yield* cavernDiskSave.flush;
						yield* sceneDirector.switchTo("overworld");
						yield* engineLogger.info("Cavern menu advanced to overworld.", {
							action: button.id,
						});
						return;
					}
					case "continue": {
						const outcome = yield* Effect.result(
							saveCoordinator.restoreSlot(cavernAutosaveSlotId),
						);
						if (Result.isFailure(outcome)) {
							yield* engineLogger.info(
								"Cavern continue ignored: no autosave on disk.",
								{},
							);
							return;
						}
						yield* sceneDirector.switchTo("overworld");
						yield* engineLogger.info("Cavern menu advanced to overworld.", {
							action: button.id,
						});
						return;
					}
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

			const updateOverworld = Effect.withSpan(
				"CavernGameplayDirector.updateOverworld",
			)(
				Effect.gen(function* () {
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
					const nextPlayerVelocity = isTryingToMove
						? applyDrag(velocityAfterAcceleration, brakingDragFactor)
						: applyDrag(playerSnapshot.velocity, idleDragFactor);

					if (isTryingToMove) {
						yield* cavernWorldState.beginRoomInstructionsFade(
							yield* runtimeClock.currentTimeMillis,
						);
					}

					const nextPlayerPosition = {
						x: playerSnapshot.position.x + nextPlayerVelocity.x,
						y: playerSnapshot.position.y + nextPlayerVelocity.y,
					};

					const unclampedPlayerBody: DynamicBodyState = {
						id: "player",
						position: nextPlayerPosition,
						size: playerSize,
						velocity: nextPlayerVelocity,
						velocityCap: maximumSpeedPerFrame,
					};
					const clampedPlayerBody = clampBodyToAccessibleArea(
						unclampedPlayerBody,
						currentRoom,
					);
					let playerBody: DynamicBodyState = {
						...clampedPlayerBody,
						velocity: {
							x:
								clampedPlayerBody.position.x === nextPlayerPosition.x
									? nextPlayerVelocity.x
									: 0,
							y:
								clampedPlayerBody.position.y === nextPlayerPosition.y
									? nextPlayerVelocity.y
									: 0,
						},
					};

					let enemyBodies: ReadonlyArray<DynamicBodyState> =
						(yield* cavernEnemyState.snapshot).map((enemy) => {
							const playerCenter = getPlayerVisualCenter(
								playerBody.position,
								playerSize,
							);
							const enemyCenter = getRectangleCenter(
								makeRectangle(enemy.position, flyerSize),
							);
							const attractionDirection = normalizeVector({
								x: playerCenter.x - enemyCenter.x,
								y: playerCenter.y - enemyCenter.y,
							});
							const velocity = clampVectorMagnitude(
								{
									x:
										enemy.velocity.x +
										attractionDirection.x * flyerAccelerationPerFrame,
									y:
										enemy.velocity.y +
										attractionDirection.y * flyerAccelerationPerFrame,
								},
								flyerMaximumSpeedPerFrame,
							);

							return clampBodyToRoom(
								{
									id: enemy.id,
									position: {
										x: enemy.position.x + velocity.x,
										y: enemy.position.y + velocity.y,
									},
									size: flyerSize,
									velocity,
									velocityCap: flyerMaximumSpeedPerFrame,
								},
								currentRoom,
							);
						});

					for (
						let iteration = 0;
						iteration < collisionIterations;
						iteration += 1
					) {
						for (
							let enemyIndex = 0;
							enemyIndex < enemyBodies.length;
							enemyIndex += 1
						) {
							const enemyBody = enemyBodies[enemyIndex];
							if (enemyBody === undefined) {
								continue;
							}
							const resolved = resolveBodyCollision(playerBody, enemyBody);
							playerBody = clampBodyToAccessibleArea(
								resolved.leftBody,
								currentRoom,
							);
							enemyBodies = replaceEnemyBody(
								enemyBodies,
								enemyIndex,
								clampBodyToRoom(resolved.rightBody, currentRoom),
							);
						}

						for (
							let leftEnemyIndex = 0;
							leftEnemyIndex < enemyBodies.length;
							leftEnemyIndex += 1
						) {
							for (
								let rightEnemyIndex = leftEnemyIndex + 1;
								rightEnemyIndex < enemyBodies.length;
								rightEnemyIndex += 1
							) {
								const leftEnemyBody = enemyBodies[leftEnemyIndex];
								const rightEnemyBody = enemyBodies[rightEnemyIndex];
								if (
									leftEnemyBody === undefined ||
									rightEnemyBody === undefined
								) {
									continue;
								}
								const resolved = resolveBodyCollision(
									leftEnemyBody,
									rightEnemyBody,
								);
								enemyBodies = replaceEnemyBody(
									enemyBodies,
									leftEnemyIndex,
									clampBodyToRoom(resolved.leftBody, currentRoom),
								);
								enemyBodies = replaceEnemyBody(
									enemyBodies,
									rightEnemyIndex,
									clampBodyToRoom(resolved.rightBody, currentRoom),
								);
							}
						}
					}

					yield* cavernEnemyState.setEnemies(
						enemyBodies.map((enemyBody) => ({
							id: enemyBody.id,
							position: enemyBody.position,
							velocity: enemyBody.velocity,
						})),
					);
					yield* cavernPlayerState.moveTo(playerBody.position);
					yield* cavernPlayerState.setVelocity(playerBody.velocity);

					const playerRectangle = makeRectangle(
						playerBody.position,
						playerBody.size,
					);
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
						yield* cavernEnemyState.enterRoom(targetRoom.id);
						yield* cavernPlayerState.moveTo(
							getTransitionSpawnPosition(
								activeTransition,
								targetRoom,
								playerBody.position,
								playerSize,
							),
						);
						yield* cavernPlayerState.setVelocity({ x: 0, y: 0 });
						yield* saveCoordinator.writeSlot(cavernAutosaveSlotId);
						yield* cavernDiskSave.flush;
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
						(yield* runtimeClock.snapshot).lastFrameDeltaMillis / 1_000;
					yield* sceneCamera.step(deltaSeconds);
				}),
			);

			const stepFrame = Effect.withSpan("CavernGameplayDirector.stepFrame")(
				Effect.gen(function* () {
					const activeSceneId = (yield* sceneDirector.snapshot).activeSceneId;
					yield* Effect.annotateCurrentSpan({
						"effect2d.game.scene_id": activeSceneId ?? "none",
					});
					if (activeSceneId === "main-menu") {
						yield* updateMenuSelection();
						return;
					}

					yield* updateOverworld;
				}),
			);

			return CavernGameplayDirector.of({
				stepFrame,
			});
		}),
	);
}
