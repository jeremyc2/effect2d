import { Effect, Layer, ServiceMap } from "effect";
import {
	type FrameSnapshot,
	Graphics,
	type GraphicsFrameNotOpenError,
	type GraphicsTransformStackUnderflowError,
	RuntimeClock,
	SceneDirector,
	type SceneStackEmptyError,
	Ui,
	type UnknownFontError,
} from "../../../../src/index.ts";
import type { MapValidationError } from "../../../../src/maps/MapError.ts";
import { BeaconRunRoomState } from "../state/BeaconRunRoomState.ts";
import { ExpeditionState } from "../state/ExpeditionState.ts";
import { ScoutState } from "../state/ScoutState.ts";

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
>()("effect2d/beacon-run/game/directors/BeaconRunPresentationDirector") {
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

			const renderTitle = Effect.fn(
				"BeaconRunPresentationDirector.renderTitle",
			)(function* () {
				yield* graphics.drawImage(
					"title-screen",
					{ x: 0, y: 0 },
					{ height: 96, width: 128 },
				);
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "ui-body",
					maxWidth: 96,
					position: { x: 16, y: 28 },
					text: "Beacon Run",
				});
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "ui-body",
					maxWidth: 96,
					position: { x: 16, y: 46 },
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

				yield* graphics.drawImage(
					typeof room.metadata["backgroundImageId"] === "string"
						? room.metadata["backgroundImageId"]
						: room.id,
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

				const beacon = room.objectPlanes
					.flatMap((plane) => plane.entries)
					.find((entry) => entry.id === "north-beacon");
				if (beacon !== undefined) {
					yield* graphics.drawImage(
						expeditionSnapshot.litBeaconIds.includes("north-beacon")
							? "beacon-lit"
							: "beacon-unlit",
						{ x: beacon.x, y: beacon.y },
						{ height: beacon.height, width: beacon.width },
					);
				}

				yield* graphics.drawImage("scout-idle", scoutSnapshot.position, {
					height: 16,
					width: 16,
				});

				yield* ui.drawTextBlock({
					fontId: "ui-body",
					position: { x: 4, y: 4 },
					text: `Room: ${
						typeof room.metadata["displayName"] === "string"
							? room.metadata["displayName"]
							: room.id
					}`,
				});
				yield* ui.drawTextBlock({
					fontId: "ui-body",
					position: { x: 4, y: 16 },
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
							position: { x: 8, y: 68 },
							size: { height: 20, width: 112 },
						},
						fontId: "ui-body",
						page: {
							hasNextPage: false,
							layout: yield* ui.wrapText(
								"ui-body",
								room.metadata["hintText"],
								100,
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
						position: { x: 20, y: 24 },
						size: { height: 40, width: 88 },
					},
					{ alpha: 0.92, blue: 0.06, green: 0.06, red: 0.06 },
				);
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "ui-body",
					maxWidth: 72,
					position: { x: 28, y: 34 },
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
