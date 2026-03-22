import { Effect, Layer, ServiceMap } from "effect";
import { defineAnimationClip } from "../../../src/animation/Animation.ts";
import {
	advanceAnimation,
	currentAnimationFrame,
	DebugOverlay,
	type FrameSnapshot,
	Graphics,
	type GraphicsFrameNotOpenError,
	type GraphicsTransformStackUnderflowError,
	type InvalidLogMessageError,
	RuntimeClock,
	SceneDirector,
	type SceneStackEmptyError,
	startAnimation,
	Ui,
	type UnknownFontError,
} from "../../../src/index.ts";
import type { MapValidationError } from "../../../src/maps/MapError.ts";
import { GameplayState } from "../state/GameplayState.ts";
import { PlayerState } from "../state/PlayerState.ts";
import { RoomState } from "../state/RoomState.ts";
import { WorldState } from "../state/WorldState.ts";

const menuBackground = {
	alpha: 1,
	blue: 0.14,
	green: 0.1,
	red: 0.08,
};

const worldBackground = {
	alpha: 1,
	blue: 0.18,
	green: 0.12,
	red: 0.08,
};

const playerClips = {
	down: defineAnimationClip({
		frames: ["player-down-a", "player-down-b"],
		framesPerSecond: 6,
		id: "player-down",
	}),
	left: defineAnimationClip({
		frames: ["player-left-a", "player-left-b"],
		framesPerSecond: 6,
		id: "player-left",
	}),
	right: defineAnimationClip({
		frames: ["player-right-a", "player-right-b"],
		framesPerSecond: 6,
		id: "player-right",
	}),
	up: defineAnimationClip({
		frames: ["player-up-a", "player-up-b"],
		framesPerSecond: 6,
		id: "player-up",
	}),
} as const;

const lanternClip = defineAnimationClip({
	frames: ["lantern-a", "lantern-b"],
	framesPerSecond: 4,
	id: "lantern",
});

const animatedFrame = (
	_framesPerSecond: number,
	tickCount: number,
	clip: typeof lanternClip,
): string => {
	const seconds = tickCount / 60;
	return currentAnimationFrame(
		advanceAnimation(startAnimation(clip, { mode: "loop" }), seconds),
	);
};

type StarterPresentationDirectorFailure =
	| GraphicsFrameNotOpenError
	| GraphicsTransformStackUnderflowError
	| InvalidLogMessageError
	| MapValidationError
	| SceneStackEmptyError
	| UnknownFontError;

const tileColor = (tileId: number) => {
	switch (tileId) {
		case 0:
			return {
				alpha: 1,
				blue: 0.18,
				green: 0.16,
				red: 0.14,
			};
		case 1:
			return {
				alpha: 1,
				blue: 0.24,
				green: 0.22,
				red: 0.18,
			};
		case 2:
			return {
				alpha: 1,
				blue: 0.12,
				green: 0.26,
				red: 0.38,
			};
		case 3:
			return {
				alpha: 1,
				blue: 0.08,
				green: 0.12,
				red: 0.1,
			};
		default:
			return {
				alpha: 1,
				blue: 0.28,
				green: 0.1,
				red: 0.32,
			};
	}
};

export class StarterPresentationDirector extends ServiceMap.Service<
	StarterPresentationDirector,
	{
		readonly renderFrame: () => Effect.Effect<
			FrameSnapshot,
			StarterPresentationDirectorFailure
		>;
	}
>()("effect2d/starter/game/directors/StarterPresentationDirector") {
	static readonly layer = Layer.effect(
		StarterPresentationDirector,
		Effect.gen(function* () {
			const debugOverlay = yield* DebugOverlay;
			const graphics = yield* Graphics;
			const gameplayState = yield* GameplayState;
			const playerState = yield* PlayerState;
			const roomState = yield* RoomState;
			const runtimeClock = yield* RuntimeClock;
			const sceneDirector = yield* SceneDirector;
			const ui = yield* Ui;
			const worldState = yield* WorldState;

			const renderMenu = Effect.fn("StarterPresentationDirector.renderMenu")(
				function* () {
					yield* graphics.drawImage(
						"title-screen",
						{ x: 0, y: 0 },
						{
							height: 96,
							width: 128,
						},
					);
					yield* ui.drawPanel(
						{
							position: { x: 12, y: 18 },
							size: { height: 60, width: 104 },
						},
						{
							alpha: 0.88,
							blue: 0.07,
							green: 0.05,
							red: 0.04,
						},
					);
					yield* ui.drawTextBlock({
						align: "center",
						fontId: "ui-body",
						maxWidth: 88,
						position: { x: 20, y: 28 },
						text: "effect2d starter",
					});
					yield* ui.drawTextBlock({
						align: "center",
						fontId: "ui-body",
						maxWidth: 88,
						position: { x: 20, y: 46 },
						text: "Press Enter to begin",
					});
				},
			);

			const renderWorld = Effect.fn("StarterPresentationDirector.renderWorld")(
				function* () {
					const gameplaySnapshot = yield* gameplayState.snapshot;
					const playerSnapshot = yield* playerState.snapshot;
					const timing = yield* runtimeClock.snapshot();
					const worldSnapshot = yield* worldState.snapshot;
					const room = yield* roomState.snapshot;
					const terrainPlane = room.tilePlanes[0];
					const lanternPickup = room.objectPlanes
						.flatMap((plane) => plane.entries)
						.find((entry) => entry.id === "lantern-pickup");
					const backgroundImageId =
						typeof room.metadata["backgroundImageId"] === "string"
							? room.metadata["backgroundImageId"]
							: worldSnapshot.currentRoomId;
					const displayName =
						typeof room.metadata["displayName"] === "string"
							? room.metadata["displayName"]
							: worldSnapshot.currentRoomId;
					const hintText =
						typeof room.metadata["hintText"] === "string"
							? room.metadata["hintText"]
							: null;

					yield* graphics.drawImage(
						backgroundImageId,
						{ x: 0, y: 0 },
						{ height: 96, width: 128 },
					);

					if (terrainPlane !== undefined) {
						for (let y = 0; y < terrainPlane.height; y += 1) {
							for (let x = 0; x < terrainPlane.width; x += 1) {
								const tile = terrainPlane.tiles[y * terrainPlane.width + x];
								if (tile === undefined) {
									continue;
								}

								yield* graphics.drawRectangle(
									{ x: x * 16, y: y * 16 },
									{ height: 16, width: 16 },
									"fill",
									tileColor(tile),
								);
							}
						}
					}

					const playerImageId = currentAnimationFrame(
						advanceAnimation(
							startAnimation(playerClips[playerSnapshot.facing], {
								mode: "loop",
							}),
							timing.tickCount / 60,
						),
					);

					yield* graphics.drawImage(playerImageId, playerSnapshot.position, {
						height: 16,
						width: 16,
					});

					if (
						worldSnapshot.currentRoomId === "lantern-room" &&
						!gameplaySnapshot.lanternPickupCollected &&
						lanternPickup !== undefined
					) {
						yield* graphics.drawImage(
							animatedFrame(4, timing.tickCount, lanternClip),
							{ x: lanternPickup.x, y: lanternPickup.y },
							{ height: lanternPickup.height, width: lanternPickup.width },
						);
					}

					if (
						worldSnapshot.currentRoomId === "lantern-room" &&
						!gameplaySnapshot.enemyDefeated
					) {
						yield* graphics.drawImage(
							"slime-idle",
							gameplaySnapshot.enemyPosition,
							{ height: 14, width: 14 },
						);
					}

					yield* ui.drawTextBlock({
						fontId: "ui-body",
						position: { x: 4, y: 4 },
						text: `Room: ${displayName}`,
					});
					yield* ui.drawTextBlock({
						fontId: "ui-body",
						position: { x: 4, y: 16 },
						text: `Inventory: ${worldSnapshot.inventory.join(", ") || "empty"}`,
					});

					if (hintText !== null && !worldSnapshot.lanternLit) {
						yield* ui.drawDialogueBox({
							bounds: {
								position: { x: 8, y: 68 },
								size: { height: 20, width: 112 },
							},
							fontId: "ui-body",
							page: {
								hasNextPage: false,
								layout: yield* ui.wrapText("ui-body", hintText, 100),
								pageCount: 1,
								pageIndex: 0,
							},
						});
					}
				},
			);

			const renderPauseOverlay = Effect.fn(
				"StarterPresentationDirector.renderPauseOverlay",
			)(function* () {
				yield* ui.drawPanel(
					{
						position: { x: 20, y: 24 },
						size: { height: 40, width: 88 },
					},
					{
						alpha: 0.92,
						blue: 0.06,
						green: 0.06,
						red: 0.06,
					},
				);
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "ui-body",
					maxWidth: 72,
					position: { x: 28, y: 34 },
					text: "Paused\nEnter or Esc",
				});
			});

			const renderDebugOverlay = Effect.fn(
				"StarterPresentationDirector.renderDebugOverlay",
			)(function* () {
				const drawModel = yield* debugOverlay.drawModel;
				const snapshot = drawModel.snapshot;
				if (!snapshot.enabled) {
					return;
				}

				for (let index = 0; index < drawModel.lines.length; index += 1) {
					const line = drawModel.lines[index];
					if (line === undefined) {
						continue;
					}

					yield* graphics.drawText({
						fontId: "ui-body",
						position: { x: 2, y: 2 + index * 10 },
						text: line,
					});
				}
			});

			const renderFrame = Effect.fn("StarterPresentationDirector.renderFrame")(
				function* () {
					yield* runtimeClock.beginFrame();
					yield* graphics.beginFrame;

					const sceneSnapshot = yield* sceneDirector.snapshot;
					yield* graphics.clear(
						sceneSnapshot.activeSceneId === "main-menu"
							? menuBackground
							: worldBackground,
					);

					if (
						sceneSnapshot.entries.some((entry) => entry.sceneId === "overworld")
					) {
						yield* renderWorld();
					} else {
						yield* renderMenu();
					}

					if (
						sceneSnapshot.entries.some(
							(entry) => entry.sceneId === "pause-overlay",
						)
					) {
						yield* renderPauseOverlay();
					}

					yield* renderDebugOverlay();
					return yield* graphics.endFrame;
				},
			);

			return StarterPresentationDirector.of({
				renderFrame,
			});
		}),
	);
}
