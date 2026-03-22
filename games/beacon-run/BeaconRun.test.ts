import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import {
	Audio,
	Input,
	SaveCoordinator,
	SceneDirector,
} from "../../src/index.ts";
import { runLayerEffect } from "../../src/testing/runEffectTest.ts";
import {
	BeaconRunLive,
	beaconRunBootstrap,
	beaconRunProgram,
} from "./game/BeaconRunGame.ts";
import { BeaconRunGameplayDirector } from "./game/directors/BeaconRunGameplayDirector.ts";
import { BeaconRunPresentationDirector } from "./game/directors/BeaconRunPresentationDirector.ts";
import { BeaconRunSaveParticipants } from "./game/save/BeaconRunSaveParticipants.ts";
import { BeaconRunRoomState } from "./game/state/BeaconRunRoomState.ts";
import { ExpeditionState } from "./game/state/ExpeditionState.ts";
import { ScoutState } from "./game/state/ScoutState.ts";

describe("beacon-run", () => {
	test("boots and launches through its own game entry point", async () => {
		await runLayerEffect(BeaconRunLive, beaconRunProgram);
	});

	test("runs a distinct game slice and persists expedition progress", async () => {
		await runLayerEffect(
			BeaconRunLive,
			Effect.gen(function* () {
				const audio = yield* Audio;
				const beaconRunGameplayDirector = yield* BeaconRunGameplayDirector;
				const beaconRunPresentationDirector =
					yield* BeaconRunPresentationDirector;
				const beaconRunSaveParticipants = yield* BeaconRunSaveParticipants;
				const beaconRunRoomState = yield* BeaconRunRoomState;
				const expeditionState = yield* ExpeditionState;
				const input = yield* Input;
				const sceneDirector = yield* SceneDirector;
				const scoutState = yield* ScoutState;

				yield* beaconRunBootstrap;

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Enter",
					type: "key-down",
				});
				yield* beaconRunGameplayDirector.stepFrame();
				expect((yield* sceneDirector.snapshot).activeSceneId).toBe("field");

				for (let index = 0; index < 9; index += 1) {
					yield* input.beginFrame;
					yield* input.applyEvent({
						key: "ArrowRight",
						type: "key-down",
					});
					yield* beaconRunGameplayDirector.stepFrame();
				}

				expect((yield* expeditionState.snapshot).currentRoomId).toBe(
					"shrine-room",
				);
				expect((yield* beaconRunRoomState.snapshot).id).toBe("shrine-room");

				for (let index = 0; index < 7; index += 1) {
					yield* input.beginFrame;
					yield* input.applyEvent({
						key: "ArrowRight",
						type: "key-down",
					});
					yield* beaconRunGameplayDirector.stepFrame();
				}

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "ArrowRight",
					type: "key-up",
				});

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Space",
					type: "key-down",
				});
				yield* beaconRunGameplayDirector.stepFrame();

				expect((yield* expeditionState.snapshot).missionComplete).toBe(true);
				expect((yield* expeditionState.snapshot).litBeaconIds).toContain(
					"north-beacon",
				);

				const frame = yield* beaconRunPresentationDirector.renderFrame();
				expect(
					frame.commands.some(
						(command) =>
							command.type === "draw-text" &&
							command.text.includes("Beacon lit"),
					),
				).toBe(true);

				const participants = yield* beaconRunSaveParticipants.all;
				const saveProgram = Effect.gen(function* () {
					const saveCoordinator = yield* SaveCoordinator;
					yield* saveCoordinator.writeSlot("slot-a");

					yield* expeditionState.restore({
						currentRoomId: "field-room",
						litBeaconIds: [],
						missionComplete: false,
					});
					yield* scoutState.restore({
						facing: "down",
						position: { x: 24, y: 32 },
					});

					yield* saveCoordinator.restoreSlot("slot-a");
				});

				yield* Effect.scoped(
					Effect.gen(function* () {
						const saveServices = yield* Layer.build(
							SaveCoordinator.layer({
								participants,
								version: 1,
							}),
						);
						yield* Effect.provideServices(saveProgram, saveServices);
					}),
				);

				expect((yield* expeditionState.snapshot).missionComplete).toBe(true);
				expect((yield* audio.music)?.cueId).toBe("beacon-run-theme");
			}),
		);
	});
});
