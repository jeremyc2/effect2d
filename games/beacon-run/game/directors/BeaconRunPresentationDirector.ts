import { Effect, Layer, ServiceMap } from "effect";
import {
	type FrameSnapshot,
	Graphics,
	type GraphicsFrameNotOpenError,
	type GraphicsTransformStackUnderflowError,
	RuntimeClock,
	roomObjectById,
	SceneDirector,
	type SceneStackEmptyError,
	Ui,
	type UnknownFontError,
} from "../../../../src/index.ts";
import type { MapValidationError } from "../../../../src/maps/MapError.ts";
import { BeaconRunRoomState } from "../state/BeaconRunRoomState.ts";
import { ExpeditionState } from "../state/ExpeditionState.ts";
import { ScoutState } from "../state/ScoutState.ts";

const viewport = {
	height: 192,
	width: 256,
};

const playfield = {
	height: 96,
	width: 128,
	x: 64,
	y: 48,
};

const titleBackground = {
	alpha: 1,
	blue: 0.14,
	green: 0.08,
	red: 0.06,
};

const worldBackground = {
	alpha: 1,
	blue: 0.18,
	green: 0.16,
	red: 0.1,
};

const tileColor = (tileId: number) => {
	switch (tileId) {
		case 0:
			return { alpha: 1, blue: 0.2, green: 0.22, red: 0.16 };
		case 1:
			return { alpha: 1, blue: 0.1, green: 0.14, red: 0.26 };
		case 2:
			return { alpha: 1, blue: 0.12, green: 0.32, red: 0.18 };
		case 3:
			return { alpha: 1, blue: 0.22, green: 0.18, red: 0.24 };
		default:
			return { alpha: 1, blue: 0.22, green: 0.12, red: 0.3 };
	}
};

const worldToViewport = (position: {
	readonly x: number;
	readonly y: number;
}) => ({
	x: playfield.x + position.x,
	y: playfield.y + position.y,
});

type BeaconRunPresentationDirectorFailure =
	| GraphicsFrameNotOpenError
	| GraphicsTransformStackUnderflowError
	| MapValidationError
	| SceneStackEmptyError
	| UnknownFontError;

export class BeaconRunPresentationDirector extends ServiceMap.Service<
	BeaconRunPresentationDirector,
	{
		readonly renderFrame: () => Effect.Effect<
			FrameSnapshot,
			BeaconRunPresentationDirectorFailure
		>;
	}
>()("effect2d/games/beacon-run/game/directors/BeaconRunPresentationDirector") {
	static readonly layer = Layer.effect(
		BeaconRunPresentationDirector,
		Effect.gen(function* () {
			const beaconRunRoomState = yield* BeaconRunRoomState;
			const expeditionState = yield* ExpeditionState;
			const graphics = yield* Graphics;
			const runtimeClock = yield* RuntimeClock;
			const sceneDirector = yield* SceneDirector;
			const scoutState = yield* ScoutState;
			const ui = yield* Ui;

			const tileBackground = Effect.fn(
				"BeaconRunPresentationDirector.tileBackground",
			)(function* (imageId: string, tileWidth: number, tileHeight: number) {
				for (let y = 0; y < viewport.height; y += tileHeight) {
					for (let x = 0; x < viewport.width; x += tileWidth) {
						yield* graphics.drawImage(
							imageId,
							{ x, y },
							{
								height: tileHeight,
								width: tileWidth,
							},
						);
					}
				}
			});

			const renderTitle = Effect.fn(
				"BeaconRunPresentationDirector.renderTitle",
			)(function* () {
				yield* tileBackground("title-screen", 128, 96);
				yield* ui.drawPanel(
					{
						position: { x: 48, y: 40 },
						size: { height: 112, width: 160 },
					},
					{ alpha: 0.3, blue: 0.03, green: 0.03, red: 0.03 },
					{ alpha: 0.8, blue: 0.85, green: 0.85, red: 0.85 },
				);
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "ui-body",
					maxWidth: 144,
					position: { x: 56, y: 58 },
					text: "Beacon Run",
				});
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "ui-body",
					maxWidth: 128,
					position: { x: 64, y: 94 },
					text: "Press Enter to scout the ridge",
				});
			});

			const renderWorld = Effect.fn(
				"BeaconRunPresentationDirector.renderWorld",
			)(function* () {
				const expeditionSnapshot = yield* expeditionState.snapshot;
				const room = yield* beaconRunRoomState.snapshot;
				const scoutSnapshot = yield* scoutState.snapshot;
				yield* runtimeClock.snapshot();
				const terrainPlane = room.tilePlanes[0];

				yield* tileBackground(
					typeof room.metadata["backgroundImageId"] === "string"
						? room.metadata["backgroundImageId"]
						: room.id,
					128,
					96,
				);
				yield* ui.drawPanel(
					{
						position: { x: playfield.x - 4, y: playfield.y - 4 },
						size: { height: playfield.height + 8, width: playfield.width + 8 },
					},
					{ alpha: 0.12, blue: 0.02, green: 0.02, red: 0.02 },
					{ alpha: 0.65, blue: 0.9, green: 0.9, red: 0.9 },
				);

				if (terrainPlane !== undefined) {
					for (let y = 0; y < terrainPlane.height; y += 1) {
						for (let x = 0; x < terrainPlane.width; x += 1) {
							const tile = terrainPlane.tiles[y * terrainPlane.width + x];
							if (tile === undefined) {
								continue;
							}

							yield* graphics.drawRectangle(
								worldToViewport({ x: x * 16, y: y * 16 }),
								{ height: 16, width: 16 },
								"fill",
								tileColor(tile),
							);
						}
					}
				}

				const beacon = roomObjectById(room, "north-beacon");
				if (beacon !== undefined) {
					yield* graphics.drawImage(
						expeditionSnapshot.litBeaconIds.includes("north-beacon")
							? "beacon-lit"
							: "beacon-unlit",
						worldToViewport({ x: beacon.x, y: beacon.y }),
						{ height: beacon.height, width: beacon.width },
					);
				}

				yield* graphics.drawImage(
					"scout-idle",
					worldToViewport(scoutSnapshot.position),
					{
						height: 16,
						width: 16,
					},
				);

				const exitZone = roomObjectById(room, "to-shrine-room");
				if (exitZone !== undefined) {
					yield* graphics.drawRectangle(
						worldToViewport({ x: exitZone.x, y: exitZone.y }),
						{ height: exitZone.height, width: exitZone.width },
						"stroke",
						{ alpha: 0.95, blue: 0.92, green: 0.92, red: 0.92 },
					);
					yield* ui.drawTextBlock({
						fontId: "ui-body",
						position: worldToViewport({
							x: Math.max(0, exitZone.x - 10),
							y: Math.max(0, exitZone.y - 14),
						}),
						text: "EXIT",
					});
				}

				yield* ui.drawTextBlock({
					fontId: "ui-body",
					position: { x: 12, y: 12 },
					text: `Room: ${
						typeof room.metadata["displayName"] === "string"
							? room.metadata["displayName"]
							: room.id
					}`,
				});
				yield* ui.drawTextBlock({
					fontId: "ui-body",
					position: { x: 12, y: 26 },
					text: expeditionSnapshot.missionComplete
						? "Beacon lit"
						: "Beacon unlit",
				});
				if (
					typeof room.metadata["hintText"] === "string" &&
					!expeditionSnapshot.missionComplete
				) {
					yield* ui.drawDialogueBox({
						bounds: {
							position: { x: 64, y: 156 },
							size: { height: 24, width: 128 },
						},
						fontId: "ui-body",
						page: {
							hasNextPage: false,
							layout: yield* ui.wrapText(
								"ui-body",
								room.metadata["hintText"],
								112,
							),
							pageCount: 1,
							pageIndex: 0,
						},
					});
				}
			});

			const renderPause = Effect.fn(
				"BeaconRunPresentationDirector.renderPause",
			)(function* () {
				yield* ui.drawPanel(
					{
						position: { x: 84, y: 68 },
						size: { height: 56, width: 88 },
					},
					{ alpha: 0.92, blue: 0.06, green: 0.06, red: 0.06 },
				);
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "ui-body",
					maxWidth: 72,
					position: { x: 92, y: 84 },
					text: "Paused\nEnter or Esc",
				});
			});

			const renderFrame = Effect.fn(
				"BeaconRunPresentationDirector.renderFrame",
			)(function* () {
				yield* runtimeClock.beginFrame();
				yield* graphics.beginFrame;

				const sceneSnapshot = yield* sceneDirector.snapshot;
				yield* graphics.clear(
					sceneSnapshot.activeSceneId === "title"
						? titleBackground
						: worldBackground,
				);

				if (sceneSnapshot.entries.some((entry) => entry.sceneId === "field")) {
					yield* renderWorld();
				} else {
					yield* renderTitle();
				}

				if (sceneSnapshot.entries.some((entry) => entry.sceneId === "pause")) {
					yield* renderPause();
				}

				return yield* graphics.endFrame;
			});

			return BeaconRunPresentationDirector.of({
				renderFrame,
			});
		}),
	);
}
