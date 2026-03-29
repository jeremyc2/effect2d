import { Effect, Layer, ServiceMap } from "effect";
import {
	type FrameSnapshot,
	Graphics,
	type GraphicsFrameNotOpenError,
	type GraphicsTransformStackUnderflowError,
	Input,
	RuntimeClock,
	SceneCamera,
	SceneDirector,
	type SceneStackEmptyError,
	UI,
	type UnknownFontError,
} from "../../../../src/index.ts";
import { cavernMenuButtons } from "../content/CavernMenu.ts";
import {
	type CavernRectangle,
	cavernViewport,
	getCavernRoom,
} from "../content/CavernWorld.ts";
import { CavernEnemyState } from "../state/CavernEnemyState.ts";
import { CavernMenuState } from "../state/CavernMenuState.ts";
import { CavernPlayerState } from "../state/CavernPlayerState.ts";
import { CavernWorldState } from "../state/CavernWorldState.ts";

const menuTitleY = 140;

const menuBackground = {
	alpha: 1,
	blue: 0.09,
	green: 0.14,
	red: 0.12,
};

const selectedBorder = {
	alpha: 1,
	blue: 1,
	green: 1,
	red: 1,
};

const mutedTint = {
	alpha: 0.45,
	blue: 0.35,
	green: 0.35,
	red: 0.35,
};

const roomFill = {
	alpha: 1,
	blue: 0.12,
	green: 0.16,
	red: 0.15,
};

const roomGrid = {
	alpha: 0.3,
	blue: 0.4,
	green: 0.48,
	red: 0.46,
};

const exitFill = {
	alpha: 0.28,
	blue: 0.38,
	green: 0.8,
	red: 0.76,
};

const exitStroke = {
	alpha: 0.95,
	blue: 0.72,
	green: 0.96,
	red: 0.92,
};

const exitGlowOuter = {
	alpha: 0.08,
	blue: 0.72,
	green: 0.96,
	red: 0.92,
};

const exitGlowInner = {
	alpha: 0.16,
	blue: 0.6,
	green: 0.88,
	red: 0.84,
};

const overlayFill = {
	alpha: 0.72,
	blue: 0.07,
	green: 0.11,
	red: 0.09,
};

const overlayStroke = {
	alpha: 0.9,
	blue: 0.36,
	green: 0.62,
	red: 0.56,
};

const roomLabelFill = {
	alpha: 0.82,
	blue: 0.08,
	green: 0.1,
	red: 0.09,
};

const roomLabelStroke = {
	alpha: 0.95,
	blue: 0.3,
	green: 0.38,
	red: 0.35,
};

const instructionHoldDurationMillis = 2_000;
const instructionFadeDurationMillis = 1_200;

const playerRenderSize = {
	height: 192,
	width: 80,
} as const;
const flyerRenderSize = {
	height: 92,
	width: 92,
} as const;
const flyerWingFrameOneSize = {
	height: 34,
	width: 140,
} as const;
const flyerWingFrameTwoSize = {
	height: 28,
	width: 151,
} as const;
const flyerEyeSize = {
	height: 48,
	width: 48,
} as const;

type CavernPresentationDirectorFailure =
	| GraphicsFrameNotOpenError
	| GraphicsTransformStackUnderflowError
	| SceneStackEmptyError
	| UnknownFontError;

const tileSize = 128;

const overlapsOnAxis = (
	startA: number,
	lengthA: number,
	startB: number,
	lengthB: number,
): boolean => startA < startB + lengthB && startA + lengthA > startB;

const rectanglesOverlap = (
	left: CavernRectangle,
	right: CavernRectangle,
): boolean =>
	overlapsOnAxis(left.x, left.width, right.x, right.width) &&
	overlapsOnAxis(left.y, left.height, right.y, right.height);

function getBackgroundOffset(position: number, tileExtent: number): number {
	const modulo = position % tileExtent;
	return modulo < 0 ? modulo + tileExtent : modulo;
}

function screenPointToWorldX(
	screenX: number,
	camera: {
		readonly position: {
			readonly x: number;
		};
		readonly zoom: number;
	},
): number {
	return (screenX - cavernViewport.width / 2) / camera.zoom + camera.position.x;
}

function getInstructionOverlayOpacity(
	nowMillis: number,
	fadeStartedAtMillis: number | null,
): number {
	if (fadeStartedAtMillis === null) {
		return 1;
	}

	const elapsedMillis = nowMillis - fadeStartedAtMillis;
	if (elapsedMillis <= instructionHoldDurationMillis) {
		return 1;
	}

	if (
		elapsedMillis >=
		instructionHoldDurationMillis + instructionFadeDurationMillis
	) {
		return 0;
	}

	return (
		1 -
		(elapsedMillis - instructionHoldDurationMillis) /
			instructionFadeDurationMillis
	);
}

function getFlyerAngle(
	from: { readonly x: number; readonly y: number },
	to: { readonly x: number; readonly y: number },
): number {
	return Math.atan2(to.y - from.y, to.x - from.x);
}

function normalizeVector(vector: { readonly x: number; readonly y: number }): {
	readonly x: number;
	readonly y: number;
} {
	const magnitude = Math.hypot(vector.x, vector.y);
	if (magnitude === 0) {
		return {
			x: 1,
			y: 0,
		};
	}

	return {
		x: vector.x / magnitude,
		y: vector.y / magnitude,
	};
}

function getTransitionGlowPadding(
	transition: CavernRectangle,
	room: {
		readonly bounds: CavernRectangle;
	},
): {
	readonly x: number;
	readonly y: number;
} {
	const touchesHorizontalWall =
		transition.x <= room.bounds.x ||
		transition.x + transition.width >= room.bounds.x + room.bounds.width;

	return touchesHorizontalWall
		? {
				x: 144,
				y: 56,
			}
		: {
				x: 56,
				y: 144,
			};
}

function getVisibleTransitionRectangle(
	transition: CavernRectangle,
	room: {
		readonly bounds: CavernRectangle;
	},
): CavernRectangle {
	if (transition.x <= room.bounds.x) {
		return {
			height: transition.height,
			width: tileSize,
			x: room.bounds.x,
			y: transition.y,
		};
	}

	if (transition.x + transition.width >= room.bounds.x + room.bounds.width) {
		return {
			height: transition.height,
			width: tileSize,
			x: room.bounds.x + room.bounds.width - tileSize,
			y: transition.y,
		};
	}

	if (transition.y <= room.bounds.y) {
		return {
			height: tileSize,
			width: transition.width,
			x: transition.x,
			y: room.bounds.y,
		};
	}

	return {
		height: tileSize,
		width: transition.width,
		x: transition.x,
		y: room.bounds.y + room.bounds.height - tileSize,
	};
}

export class CavernPresentationDirector extends ServiceMap.Service<
	CavernPresentationDirector,
	{
		readonly renderFrame: () => Effect.Effect<
			FrameSnapshot,
			CavernPresentationDirectorFailure
		>;
	}
>()("effect2d/games/cavern/game/directors/CavernPresentationDirector") {
	static readonly layer = Layer.effect(
		CavernPresentationDirector,
		Effect.gen(function* () {
			const cavernEnemyState = yield* CavernEnemyState;
			const cavernMenuState = yield* CavernMenuState;
			const cavernPlayerState = yield* CavernPlayerState;
			const cavernWorldState = yield* CavernWorldState;
			const graphics = yield* Graphics;
			const input = yield* Input;
			const runtimeClock = yield* RuntimeClock;
			const sceneCamera = yield* SceneCamera;
			const sceneDirector = yield* SceneDirector;
			const ui = yield* UI;

			const drawTiledBackground = Effect.fn(
				"CavernPresentationDirector.drawTiledBackground",
			)(function* () {
				for (let y = 0; y < cavernViewport.height; y += 512) {
					for (let x = 0; x < cavernViewport.width; x += 512) {
						yield* graphics.drawImage(
							"environment-bg",
							{ x, y },
							{
								height: 512,
								width: 512,
							},
						);
					}
				}
			});

			const drawMenu = Effect.fn("CavernPresentationDirector.drawMenu")(
				function* () {
					const menuSnapshot = yield* cavernMenuState.snapshot;
					yield* graphics.clear(menuBackground);
					yield* drawTiledBackground();
					yield* graphics.drawText({
						align: "center",
						fontId: "menu-title",
						position: { x: cavernViewport.width / 2, y: menuTitleY },
						text: "CAVERN",
					});

					for (let index = 0; index < cavernMenuButtons.length; index += 1) {
						const button = cavernMenuButtons[index];
						if (button === undefined) {
							continue;
						}

						const isSelected = menuSnapshot.selectedIndex === index;
						if (button.kind === "button") {
							if (isSelected) {
								yield* graphics.drawRectangle(
									{ x: button.x, y: button.y },
									{ height: button.height, width: button.width },
									"stroke",
									selectedBorder,
								);
							}

							yield* graphics.drawText({
								align: "center",
								fontId: "menu-button",
								position: {
									x: button.x + button.width / 2,
									y: button.y + 8,
								},
								text: button.label,
							});
							continue;
						}

						if (button.id === "sound" && !menuSnapshot.soundOn) {
							yield* graphics.setTint(mutedTint);
						}
						yield* graphics.drawImage(
							button.id === "sound" ? "icon-sound" : "icon-github",
							{ x: button.x + 9, y: button.y + 8 },
							{
								height: button.id === "sound" ? 54 : 56,
								width: button.id === "sound" ? 40 : 51,
							},
						);
						yield* graphics.setTint({
							alpha: 1,
							blue: 1,
							green: 1,
							red: 1,
						});
						if (isSelected) {
							yield* graphics.drawRectangle(
								{ x: button.x, y: button.y },
								{ height: button.height, width: button.width },
								"stroke",
								selectedBorder,
							);
						}
					}

					const selectedButton =
						cavernMenuButtons[menuSnapshot.selectedIndex] ??
						cavernMenuButtons[0];
					if (selectedButton !== undefined) {
						yield* graphics.drawText({
							align: "center",
							fontId: "menu-message",
							position: {
								x: cavernViewport.width / 2,
								y: cavernViewport.height - 80,
							},
							text: selectedButton.description,
						});
					}
				},
			);

			const drawWorldTileBand = Effect.fn(
				"CavernPresentationDirector.drawWorldTileBand",
			)(function* (
				startX: number,
				startY: number,
				endExclusive: number,
				horizontal: boolean,
				skipZones: ReadonlyArray<CavernRectangle>,
			) {
				const rangeStart = horizontal ? startX : startY;
				for (
					let coordinate = rangeStart;
					coordinate < endExclusive;
					coordinate += tileSize
				) {
					const tileRectangle = horizontal
						? {
								height: tileSize,
								width: tileSize,
								x: coordinate,
								y: startY,
							}
						: {
								height: tileSize,
								width: tileSize,
								x: startX,
								y: coordinate,
							};

					if (
						skipZones.some((transition) =>
							rectanglesOverlap(tileRectangle, transition),
						)
					) {
						continue;
					}

					yield* graphics.drawImage(
						"environment-wall",
						{
							x: tileRectangle.x,
							y: tileRectangle.y,
						},
						{
							height: tileSize,
							width: tileSize,
						},
					);
				}
			});

			const drawCameraParallax = Effect.fn(
				"CavernPresentationDirector.drawCameraParallax",
			)(function* () {
				const camera = yield* sceneCamera.snapshot;
				const offsetX = getBackgroundOffset(camera.position.x / 2, 512);
				const offsetY = getBackgroundOffset(camera.position.y / 2, 512);
				for (
					let screenY = -512;
					screenY < cavernViewport.height + 512;
					screenY += 512
				) {
					for (
						let screenX = -512;
						screenX < cavernViewport.width + 512;
						screenX += 512
					) {
						yield* graphics.drawImage(
							"environment-bg",
							{
								x: screenX - offsetX,
								y: screenY - offsetY,
							},
							{
								height: 512,
								width: 512,
							},
						);
					}
				}
			});

			const drawOverworld = Effect.fn(
				"CavernPresentationDirector.drawOverworld",
			)(function* () {
				const enemySnapshot = yield* cavernEnemyState.snapshot;
				const playerSnapshot = yield* cavernPlayerState.snapshot;
				const worldSnapshot = yield* cavernWorldState.snapshot;
				const room = getCavernRoom(worldSnapshot.currentRoomId);
				const camera = yield* sceneCamera.snapshot;
				const pointer = yield* input.pointerPosition;
				const nowMillis = yield* runtimeClock.currentTimeMillis;
				const instructionOverlayOpacity = getInstructionOverlayOpacity(
					nowMillis,
					worldSnapshot.roomInstructionsFadeStartedAtMillis,
				);
				const pointerHasMoved = pointer.x !== 0 || pointer.y !== 0;
				const playerCenterX =
					playerSnapshot.position.x + playerRenderSize.width / 2;
				const playerFacesLeft =
					pointerHasMoved &&
					screenPointToWorldX(pointer.x, camera) < playerCenterX;
				yield* graphics.clear(menuBackground);
				yield* drawCameraParallax();
				yield* graphics.pushTransform({
					rotationRadians: 0,
					scaleX: camera.zoom,
					scaleY: camera.zoom,
					translation: {
						x: cavernViewport.width / 2 - camera.position.x * camera.zoom,
						y: cavernViewport.height / 2 - camera.position.y * camera.zoom,
					},
				});
				yield* graphics.drawRectangle(
					{ x: room.bounds.x, y: room.bounds.y },
					{
						height: room.bounds.height,
						width: room.bounds.width,
					},
					"fill",
					roomFill,
				);
				for (
					let x = room.bounds.x + tileSize;
					x < room.bounds.x + room.bounds.width;
					x += tileSize * 2
				) {
					yield* graphics.drawLine(
						{ x, y: room.bounds.y },
						{ x, y: room.bounds.y + room.bounds.height },
						roomGrid,
					);
				}
				for (
					let y = room.bounds.y + tileSize;
					y < room.bounds.y + room.bounds.height;
					y += tileSize * 2
				) {
					yield* graphics.drawLine(
						{ x: room.bounds.x, y },
						{ x: room.bounds.x + room.bounds.width, y },
						roomGrid,
					);
				}
				for (const decoration of room.decorations) {
					yield* graphics.drawRectangle(
						{
							x: decoration.rectangle.x,
							y: decoration.rectangle.y,
						},
						{
							height: decoration.rectangle.height,
							width: decoration.rectangle.width,
						},
						"fill",
						decoration.color,
					);
				}

				const visibleTransitions = room.transitions.map((transition) =>
					getVisibleTransitionRectangle(transition, room),
				);

				const leftEdgeTransitions = visibleTransitions.filter(
					(transition) => transition.x <= room.bounds.x,
				);
				const rightEdgeTransitions = visibleTransitions.filter(
					(transition) =>
						transition.x + transition.width >=
						room.bounds.x + room.bounds.width,
				);
				const topEdgeTransitions = visibleTransitions.filter(
					(transition) => transition.y <= room.bounds.y,
				);
				const bottomEdgeTransitions = visibleTransitions.filter(
					(transition) =>
						transition.y + transition.height >=
						room.bounds.y + room.bounds.height,
				);

				yield* drawWorldTileBand(
					room.bounds.x,
					room.bounds.y,
					room.bounds.x + room.bounds.width,
					true,
					topEdgeTransitions,
				);
				yield* drawWorldTileBand(
					room.bounds.x,
					room.bounds.y + room.bounds.height - tileSize,
					room.bounds.x + room.bounds.width,
					true,
					bottomEdgeTransitions,
				);
				yield* drawWorldTileBand(
					room.bounds.x,
					room.bounds.y,
					room.bounds.y + room.bounds.height,
					false,
					leftEdgeTransitions,
				);
				yield* drawWorldTileBand(
					room.bounds.x + room.bounds.width - tileSize,
					room.bounds.y,
					room.bounds.y + room.bounds.height,
					false,
					rightEdgeTransitions,
				);

				for (const visibleTransition of visibleTransitions) {
					const outerGlowPadding = getTransitionGlowPadding(
						visibleTransition,
						room,
					);
					const innerGlowPadding = {
						x: Math.round(outerGlowPadding.x * 0.5),
						y: Math.round(outerGlowPadding.y * 0.5),
					};
					const coreGlowPadding = {
						x: Math.round(outerGlowPadding.x * 0.25),
						y: Math.round(outerGlowPadding.y * 0.25),
					};

					yield* graphics.drawRectangle(
						{
							x: visibleTransition.x - outerGlowPadding.x,
							y: visibleTransition.y - outerGlowPadding.y,
						},
						{
							height: visibleTransition.height + outerGlowPadding.y * 2,
							width: visibleTransition.width + outerGlowPadding.x * 2,
						},
						"fill",
						exitGlowOuter,
					);
					yield* graphics.drawRectangle(
						{
							x: visibleTransition.x - innerGlowPadding.x,
							y: visibleTransition.y - innerGlowPadding.y,
						},
						{
							height: visibleTransition.height + innerGlowPadding.y * 2,
							width: visibleTransition.width + innerGlowPadding.x * 2,
						},
						"fill",
						exitGlowInner,
					);
					yield* graphics.drawRectangle(
						{
							x: visibleTransition.x - coreGlowPadding.x,
							y: visibleTransition.y - coreGlowPadding.y,
						},
						{
							height: visibleTransition.height + coreGlowPadding.y * 2,
							width: visibleTransition.width + coreGlowPadding.x * 2,
						},
						"fill",
						{
							alpha: 0.22,
							blue: 0.54,
							green: 0.84,
							red: 0.8,
						},
					);
					yield* graphics.drawRectangle(
						{ x: visibleTransition.x, y: visibleTransition.y },
						{
							height: visibleTransition.height,
							width: visibleTransition.width,
						},
						"fill",
						exitFill,
					);
					yield* graphics.drawRectangle(
						{ x: visibleTransition.x, y: visibleTransition.y },
						{
							height: visibleTransition.height,
							width: visibleTransition.width,
						},
						"stroke",
						exitStroke,
					);
					yield* graphics.drawText({
						align: "center",
						fontId: "intro-font",
						position: {
							x: visibleTransition.x + visibleTransition.width / 2,
							y: visibleTransition.y + visibleTransition.height / 2 - 20,
						},
						text: "EXIT",
					});
				}

				for (const enemy of enemySnapshot) {
					const wingFrameOne = Math.floor(nowMillis / 120) % 2 === 0;
					const wingImageId = wingFrameOne
						? "enemy-flyer-wing-1"
						: "enemy-flyer-wing-2";
					const wingSize = wingFrameOne
						? flyerWingFrameOneSize
						: flyerWingFrameTwoSize;
					const enemyCenter = {
						x: enemy.position.x + flyerRenderSize.width / 2,
						y: enemy.position.y + flyerRenderSize.height / 2,
					};
					const playerCenter = {
						x: playerSnapshot.position.x + playerRenderSize.width / 2,
						y: playerSnapshot.position.y + playerRenderSize.height / 2,
					};
					const lookDirection = normalizeVector({
						x: playerCenter.x - enemyCenter.x,
						y: playerCenter.y - enemyCenter.y,
					});
					const eyeOffset = {
						x: lookDirection.x * 14,
						y: lookDirection.y * 14,
					};

					yield* graphics.setTint({
						alpha: 0.314,
						blue: 1,
						green: 1,
						red: 1,
					});
					yield* graphics.drawImage(
						wingImageId,
						{
							x: enemyCenter.x - wingSize.width / 2,
							y: enemyCenter.y - wingSize.height / 2 - (wingFrameOne ? 24 : 19),
						},
						wingSize,
					);
					yield* graphics.setTint({
						alpha: 1,
						blue: 1,
						green: 1,
						red: 1,
					});
					yield* graphics.pushTransform({
						rotationRadians: getFlyerAngle(enemyCenter, playerCenter),
						scaleX: 1,
						scaleY: 1,
						translation: enemyCenter,
					});
					yield* graphics.drawImage(
						"enemy-flyer-body",
						{
							x: -flyerRenderSize.width / 2,
							y: -flyerRenderSize.height / 2,
						},
						flyerRenderSize,
					);
					yield* graphics.popTransform;
					yield* graphics.drawImage(
						"enemy-flyer-eye",
						{
							x: enemyCenter.x - flyerEyeSize.width / 2 + eyeOffset.x,
							y: enemyCenter.y - flyerEyeSize.height / 2 + eyeOffset.y,
						},
						flyerEyeSize,
					);
				}

				yield* graphics.pushTransform({
					rotationRadians: 0,
					scaleX: playerFacesLeft ? -1 : 1,
					scaleY: 1,
					translation: {
						x:
							playerSnapshot.position.x +
							(playerFacesLeft ? playerRenderSize.width : 0),
						y: playerSnapshot.position.y,
					},
				});
				yield* graphics.drawImage("player-new", { x: 0, y: 0 });
				yield* graphics.popTransform;
				yield* graphics.popTransform;
				yield* graphics.drawRectangle(
					{
						x: cavernViewport.width / 2 - 260,
						y: 18,
					},
					{
						height: 44,
						width: 520,
					},
					"fill",
					roomLabelFill,
				);
				yield* graphics.drawRectangle(
					{
						x: cavernViewport.width / 2 - 260,
						y: 18,
					},
					{
						height: 44,
						width: 520,
					},
					"stroke",
					roomLabelStroke,
				);
				yield* graphics.drawText({
					align: "center",
					fontId: "menu-message",
					position: {
						x: cavernViewport.width / 2,
						y: 24,
					},
					text: room.name,
				});
				if (instructionOverlayOpacity > 0) {
					const instructionPanelWidth = 840;
					const instructionPanelTextWidth = 760;
					const instructionPanelX =
						cavernViewport.width / 2 - instructionPanelWidth / 2;
					const instructionPanelY = 72;
					const instructionTitleY = 84;
					const instructionBodyY = 114;
					const instructionBodyText =
						"Head toward the glowing EXIT doors. Esc returns to menu.";
					const instructionBodyLayout = yield* ui.wrapText(
						"intro-font",
						instructionBodyText,
						instructionPanelTextWidth,
					);
					const instructionPanelHeight =
						instructionBodyY -
						instructionPanelY +
						instructionBodyLayout.height +
						10;
					yield* graphics.setTint({
						alpha: instructionOverlayOpacity,
						blue: 1,
						green: 1,
						red: 1,
					});
					yield* graphics.drawRectangle(
						{
							x: instructionPanelX,
							y: instructionPanelY,
						},
						{
							height: instructionPanelHeight,
							width: instructionPanelWidth,
						},
						"fill",
						overlayFill,
					);
					yield* graphics.drawRectangle(
						{
							x: instructionPanelX,
							y: instructionPanelY,
						},
						{
							height: instructionPanelHeight,
							width: instructionPanelWidth,
						},
						"stroke",
						overlayStroke,
					);
					yield* graphics.drawText({
						align: "center",
						fontId: "intro-font",
						position: {
							x: cavernViewport.width / 2,
							y: instructionTitleY,
						},
						text: "Arrows / WASD move",
					});
					yield* ui.drawTextBlock({
						align: "center",
						fontId: "intro-font",
						maxWidth: instructionPanelTextWidth,
						position: {
							x: cavernViewport.width / 2 - instructionPanelTextWidth / 2,
							y: instructionBodyY,
						},
						text: instructionBodyText,
					});
					yield* graphics.setTint({
						alpha: 1,
						blue: 1,
						green: 1,
						red: 1,
					});
				}
			});

			const renderFrame = Effect.fn("CavernPresentationDirector.renderFrame")(
				function* () {
					yield* runtimeClock.beginFrame();
					yield* graphics.beginFrame;

					if ((yield* sceneDirector.snapshot).activeSceneId === "main-menu") {
						yield* drawMenu();
					} else {
						yield* drawOverworld();
					}

					return yield* graphics.endFrame;
				},
			);

			return CavernPresentationDirector.of({
				renderFrame,
			});
		}),
	);
}
