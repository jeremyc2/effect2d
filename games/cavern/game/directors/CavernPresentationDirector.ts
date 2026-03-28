import { Effect, Layer, ServiceMap } from "effect";
import {
	type FrameSnapshot,
	Graphics,
	type GraphicsFrameNotOpenError,
	type GraphicsTransformStackUnderflowError,
	RuntimeClock,
	SceneCamera,
	SceneDirector,
	type SceneStackEmptyError,
} from "../../../../src/index.ts";
import { cavernMenuButtons } from "../content/CavernMenu.ts";
import {
	type CavernRectangle,
	cavernViewport,
	getCavernRoom,
} from "../content/CavernWorld.ts";
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

type CavernPresentationDirectorFailure =
	| GraphicsFrameNotOpenError
	| GraphicsTransformStackUnderflowError
	| SceneStackEmptyError;

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

export class CavernPresentationDirector extends ServiceMap.Service<
	CavernPresentationDirector,
	{
		readonly renderFrame: () => Effect.Effect<
			FrameSnapshot,
			CavernPresentationDirectorFailure
		>;
	}
>()("Effect2d/games/cavern/game/directors/CavernPresentationDirector") {
	static readonly layer = Layer.effect(
		CavernPresentationDirector,
		Effect.gen(function* () {
			const cavernMenuState = yield* CavernMenuState;
			const cavernPlayerState = yield* CavernPlayerState;
			const cavernWorldState = yield* CavernWorldState;
			const graphics = yield* Graphics;
			const runtimeClock = yield* RuntimeClock;
			const sceneCamera = yield* SceneCamera;
			const sceneDirector = yield* SceneDirector;

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
				for (
					let coordinate = startX;
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
				const playerSnapshot = yield* cavernPlayerState.snapshot;
				const worldSnapshot = yield* cavernWorldState.snapshot;
				const room = getCavernRoom(worldSnapshot.currentRoomId);
				const camera = yield* sceneCamera.snapshot;
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

				const leftEdgeTransitions = room.transitions.filter(
					(transition) => transition.x <= room.bounds.x,
				);
				const rightEdgeTransitions = room.transitions.filter(
					(transition) =>
						transition.x + transition.width >=
						room.bounds.x + room.bounds.width,
				);
				const topEdgeTransitions = room.transitions.filter(
					(transition) => transition.y <= room.bounds.y,
				);
				const bottomEdgeTransitions = room.transitions.filter(
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

				for (const transition of room.transitions) {
					yield* graphics.drawRectangle(
						{ x: transition.x, y: transition.y },
						{ height: transition.height, width: transition.width },
						"fill",
						exitFill,
					);
					yield* graphics.drawRectangle(
						{ x: transition.x, y: transition.y },
						{ height: transition.height, width: transition.width },
						"stroke",
						exitStroke,
					);
					yield* graphics.drawText({
						align: "center",
						fontId: "intro-font",
						position: {
							x: transition.x + transition.width / 2,
							y: transition.y + transition.height / 2 - 20,
						},
						text: "EXIT",
					});
				}

				yield* graphics.drawImage("player-new", playerSnapshot.position);
				yield* graphics.popTransform;
				yield* graphics.drawText({
					fontId: "menu-message",
					position: { x: 40, y: 32 },
					text: `Room: ${room.name}`,
				});
				yield* graphics.drawText({
					fontId: "intro-font",
					position: { x: 40, y: 68 },
					text: "Arrow keys move. Follow the EXIT markers. Esc returns to menu.",
				});
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
