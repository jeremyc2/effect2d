import { Effect, Layer, ServiceMap } from "effect";
import {
	type FrameSnapshot,
	Graphics,
	type GraphicsFrameNotOpenError,
	type GraphicsTransformStackUnderflowError,
	RuntimeClock,
	SceneDirector,
	type SceneStackEmptyError,
} from "../../../../src/index.ts";
import {
	cavernMenuButtons,
	cavernViewport,
	cavernWorldBounds,
} from "../content/CavernMenu.ts";
import { CavernMenuState } from "../state/CavernMenuState.ts";
import { CavernPlayerState } from "../state/CavernPlayerState.ts";

const menuTitleY = 140;

const menuBackground = {
	alpha: 1,
	blue: 0.09,
	green: 0.14,
	red: 0.12,
};

const panelFill = {
	alpha: 0.9,
	blue: 0.08,
	green: 0.05,
	red: 0.05,
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

type CavernPresentationDirectorFailure =
	| GraphicsFrameNotOpenError
	| GraphicsTransformStackUnderflowError
	| SceneStackEmptyError;

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
			const cavernMenuState = yield* CavernMenuState;
			const cavernPlayerState = yield* CavernPlayerState;
			const graphics = yield* Graphics;
			const runtimeClock = yield* RuntimeClock;
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

			const drawOverworld = Effect.fn(
				"CavernPresentationDirector.drawOverworld",
			)(function* () {
				const playerSnapshot = yield* cavernPlayerState.snapshot;
				yield* graphics.clear(menuBackground);
				yield* drawTiledBackground();
				yield* graphics.drawRectangle(
					{ x: cavernWorldBounds.x - 24, y: cavernWorldBounds.y - 24 },
					{
						height: cavernWorldBounds.height + 48,
						width: cavernWorldBounds.width + 48,
					},
					"fill",
					panelFill,
				);

				for (
					let x = cavernWorldBounds.x;
					x < cavernWorldBounds.x + cavernWorldBounds.width;
					x += 128
				) {
					yield* graphics.drawImage("environment-wall", {
						x,
						y: cavernWorldBounds.y - 64,
					});
					yield* graphics.drawImage("environment-wall", {
						x,
						y: cavernWorldBounds.y + cavernWorldBounds.height - 64,
					});
				}
				for (
					let y = cavernWorldBounds.y;
					y < cavernWorldBounds.y + cavernWorldBounds.height;
					y += 128
				) {
					yield* graphics.drawImage("environment-wall", {
						x: cavernWorldBounds.x - 64,
						y,
					});
					yield* graphics.drawImage("environment-wall", {
						x: cavernWorldBounds.x + cavernWorldBounds.width - 64,
						y,
					});
				}

				yield* graphics.drawImage("player-new", playerSnapshot.position, {
					height: 222,
					width: 102,
				});
				yield* graphics.drawText({
					fontId: "menu-message",
					position: { x: 40, y: 32 },
					text: "Cavern port slice: menu, world shell, and native assets",
				});
				yield* graphics.drawText({
					fontId: "intro-font",
					position: { x: 40, y: 68 },
					text: "Arrow keys move. Esc returns to menu.",
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
