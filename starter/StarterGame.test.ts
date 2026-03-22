import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import {
	DebugOverlay,
	EngineLogger,
	Input,
	ResourceTracker,
	SaveCoordinator,
} from "../src/index.ts";
import { runLayerEffect } from "../src/testing/runEffectTest.ts";
import { StarterCoordinator } from "./game/directors/StarterCoordinator.ts";
import { StarterGameplayDirector } from "./game/directors/StarterGameplayDirector.ts";
import { starterBindings } from "./game/input/StarterBindings.ts";
import {
	StarterGameLive,
	starterBootstrap,
	starterProgram,
} from "./game/StarterGame.ts";
import { StarterSaveParticipants } from "./game/save/StarterSaveParticipants.ts";
import { GameplayState } from "./game/state/GameplayState.ts";
import { PlayerState } from "./game/state/PlayerState.ts";
import { WorldState } from "./game/state/WorldState.ts";

describe("starter", () => {
	test("bootstraps the canonical starter runtime and save participants", async () => {
		await runLayerEffect(
			StarterGameLive,
			Effect.gen(function* () {
				const debugOverlay = yield* DebugOverlay;
				const engineLogger = yield* EngineLogger;
				const input = yield* Input;
				const playerState = yield* PlayerState;
				const resourceTracker = yield* ResourceTracker;
				const starterSaveParticipants = yield* StarterSaveParticipants;
				const worldState = yield* WorldState;

				yield* starterBootstrap;

				expect(yield* input.bindings).toEqual(starterBindings);
				expect(
					(yield* starterSaveParticipants.all).map(
						(participant) => participant.key,
					),
				).toEqual(["player", "world", "gameplay", "debug-settings"]);
				expect(yield* engineLogger.entries).toHaveLength(4);
				expect(yield* resourceTracker.records).toEqual([
					{
						details: "Starter opening room is active.",
						id: "starter-overworld-room",
						kind: "map",
						state: "loaded",
					},
				]);
				expect((yield* playerState.snapshot).position).toEqual({
					x: 32,
					y: 32,
				});
				expect((yield* worldState.snapshot).currentRoomId).toBe(
					"overworld-room",
				);
				const overlaySnapshot = yield* debugOverlay.captureSnapshot;
				expect(overlaySnapshot.enabled).toBe(false);
				expect(overlaySnapshot.logs).toHaveLength(4);
			}),
		);
	});

	test("launches through the starter program entry point", async () => {
		await runLayerEffect(StarterGameLive, starterProgram);
	});

	test("demonstrates direct orchestration and event-based coordination", async () => {
		await runLayerEffect(
			StarterGameLive,
			Effect.gen(function* () {
				const engineLogger = yield* EngineLogger;
				const starterCoordinator = yield* StarterCoordinator;

				yield* starterCoordinator.beginNewGame;
				yield* starterCoordinator.recordSceneChange("overworld");
				yield* starterCoordinator.recordSaveCompleted("slot-a");
				yield* starterCoordinator.processEvents;

				expect(yield* engineLogger.entries).toEqual([
					{
						context: {
							roomId: "overworld-room",
						},
						level: "info",
						message: "Starter coordinator began a new game.",
						sequence: 0,
					},
					{
						context: {
							sceneId: "overworld",
						},
						level: "info",
						message: "Starter scene changed.",
						sequence: 1,
					},
					{
						context: {
							slotId: "slot-a",
						},
						level: "info",
						message: "Starter save completed.",
						sequence: 2,
					},
				]);
			}),
		);
	});

	test("runs a small gameplay slice with movement, transition, pickup, enemy defeat, and save restore", async () => {
		await runLayerEffect(
			StarterGameLive,
			Effect.gen(function* () {
				const gameplayState = yield* GameplayState;
				const input = yield* Input;
				const playerState = yield* PlayerState;
				const starterGameplayDirector = yield* StarterGameplayDirector;
				const starterSaveParticipants = yield* StarterSaveParticipants;
				const worldState = yield* WorldState;

				yield* starterBootstrap;

				for (let index = 0; index < 8; index += 1) {
					yield* input.beginFrame;
					yield* input.applyEvent({
						key: "ArrowRight",
						type: "key-down",
					});
					yield* starterGameplayDirector.stepFrame();
				}

				expect((yield* worldState.snapshot).currentRoomId).toBe("lantern-room");
				expect((yield* gameplayState.snapshot).introSequencePlayed).toBe(true);

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Space",
					type: "key-down",
				});
				yield* starterGameplayDirector.stepFrame();

				expect((yield* worldState.snapshot).lanternLit).toBe(true);
				expect((yield* gameplayState.snapshot).lanternPickupCollected).toBe(
					true,
				);
				expect((yield* worldState.snapshot).inventory).toContain("lantern");

				yield* playerState.restore({
					...(yield* playerState.snapshot),
					position: (yield* gameplayState.snapshot).enemyPosition,
				});

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Space",
					type: "key-up",
				});

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Space",
					type: "key-down",
				});
				yield* starterGameplayDirector.stepFrame();

				expect((yield* gameplayState.snapshot).enemyDefeated).toBe(true);

				const participants = yield* starterSaveParticipants.all;
				const saveProgram = Effect.gen(function* () {
					const saveCoordinator = yield* SaveCoordinator;
					yield* saveCoordinator.writeSlot("slot-a");

					yield* worldState.restore({
						currentRoomId: "overworld-room",
						inventory: [],
						lanternLit: false,
					});
					yield* gameplayState.restore({
						enemyDefeated: false,
						enemyPosition: { x: 72, y: 32 },
						introSequencePlayed: false,
						lanternPickupCollected: false,
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

				expect((yield* worldState.snapshot).currentRoomId).toBe("lantern-room");
				expect((yield* worldState.snapshot).lanternLit).toBe(true);
				expect((yield* gameplayState.snapshot).enemyDefeated).toBe(true);
				expect((yield* gameplayState.snapshot).lanternPickupCollected).toBe(
					true,
				);
			}),
		);
	});
});
