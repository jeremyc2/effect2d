import { describe, expect, it, test } from "bun:test";
import { Effect, Layer } from "effect";
import { Engine, Input, SceneDirector } from "../../src/index.ts";
import { runLayerEffect } from "../../src/testing/runEffectTest.ts";
import {
	CavernLive,
	cavernBootstrap,
	cavernProgram,
} from "./game/CavernGame.ts";
import {
	doesRectangleIntersect,
	getCavernRoom,
} from "./game/content/CavernWorld.ts";
import { CavernGameplayDirector } from "./game/directors/CavernGameplayDirector.ts";
import { CavernPresentationDirector } from "./game/directors/CavernPresentationDirector.ts";
import { CavernEnemyState } from "./game/state/CavernEnemyState.ts";
import { CavernPlayerState } from "./game/state/CavernPlayerState.ts";
import { CavernWorldState } from "./game/state/CavernWorldState.ts";

describe("cavern", () => {
	it("bootstraps and launches through its own game entry point", async () => {
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const services = yield* Layer.build(CavernLive);
					yield* Effect.provideServices(cavernProgram, services);
				}),
			),
		);
	});

	it("loads the Cavern menu slice and engine config", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Layer.build(CavernLive).pipe(
					Effect.flatMap((services) =>
						Effect.provideServices(
							Effect.gen(function* () {
								const engine = yield* Engine;
								yield* cavernBootstrap;
								return engine.config;
							}),
							services,
						),
					),
				),
			),
		);

		expect(result.gameId).toBe("Effect2d/cavern");
		expect(result.startScene).toBe("main-menu");
	});

	test("shows room guidance on entry, hides it after movement, and mirrors the player toward the mouse", async () => {
		await runLayerEffect(
			CavernLive,
			Effect.gen(function* () {
				const input = yield* Input;
				const cavernGameplayDirector = yield* CavernGameplayDirector;
				const cavernPresentationDirector = yield* CavernPresentationDirector;
				const cavernWorldState = yield* CavernWorldState;
				const sceneDirector = yield* SceneDirector;

				yield* cavernBootstrap;

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Enter",
					type: "key-down",
				});
				yield* cavernGameplayDirector.stepFrame();

				expect((yield* sceneDirector.snapshot).activeSceneId).toBe("overworld");

				const introFrame = yield* cavernPresentationDirector.renderFrame();
				expect(
					introFrame.commands.some(
						(command) =>
							command.type === "draw-text" &&
							command.text.includes("Arrows / WASD move"),
					),
				).toBe(true);
				expect(
					(yield* cavernWorldState.snapshot)
						.roomInstructionsFadeStartedAtMillis,
				).toBeNull();

				yield* input.beginFrame;
				yield* input.applyEvent({
					position: { x: 0, y: 384 },
					type: "mouse-move",
				});

				const leftFacingFrame = yield* cavernPresentationDirector.renderFrame();
				expect(
					leftFacingFrame.commands.some(
						(command) =>
							command.type === "push-transform" &&
							command.transform.scaleX === -1,
					),
				).toBe(true);

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "ArrowRight",
					type: "key-down",
				});
				yield* cavernGameplayDirector.stepFrame();

				const worldSnapshotAfterMove = yield* cavernWorldState.snapshot;
				expect(
					worldSnapshotAfterMove.roomInstructionsFadeStartedAtMillis,
				).not.toBeNull();

				const movedFrame = yield* cavernPresentationDirector.renderFrame();
				expect(
					movedFrame.commands.some(
						(command) =>
							command.type === "draw-text" &&
							command.text.includes("Arrows / WASD move"),
					),
				).toBe(true);

				const fadeStartedAtMillis =
					worldSnapshotAfterMove.roomInstructionsFadeStartedAtMillis;
				expect(fadeStartedAtMillis).not.toBeNull();

				yield* cavernWorldState.setCurrentRoom("rm2");
				expect(
					(yield* cavernWorldState.snapshot)
						.roomInstructionsFadeStartedAtMillis,
				).toBe(fadeStartedAtMillis);
			}),
		);
	});

	test("renders room flyers, separates enemies, and lets a fast player transfer more knockback into them", async () => {
		await runLayerEffect(
			CavernLive,
			Effect.gen(function* () {
				const cavernEnemyState = yield* CavernEnemyState;
				const cavernGameplayDirector = yield* CavernGameplayDirector;
				const cavernPlayerState = yield* CavernPlayerState;
				const cavernPresentationDirector = yield* CavernPresentationDirector;
				const input = yield* Input;
				const sceneDirector = yield* SceneDirector;

				yield* cavernBootstrap;

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Enter",
					type: "key-down",
				});
				yield* cavernGameplayDirector.stepFrame();

				expect((yield* sceneDirector.snapshot).activeSceneId).toBe("overworld");

				const roomOneEnemies = yield* cavernEnemyState.snapshot;
				expect(roomOneEnemies).toHaveLength(
					getCavernRoom("rm1").enemies.length,
				);

				const firstEnemy = roomOneEnemies[0];
				const secondEnemy = roomOneEnemies[1];
				expect(firstEnemy).toBeDefined();
				expect(secondEnemy).toBeDefined();
				if (firstEnemy === undefined || secondEnemy === undefined) {
					return;
				}

				yield* cavernEnemyState.setEnemies([
					{
						...firstEnemy,
						position: {
							x: 1200,
							y: 720,
						},
						velocity: {
							x: 7,
							y: 0,
						},
					},
					{
						...secondEnemy,
						position: {
							x: 1220,
							y: 720,
						},
						velocity: {
							x: 0,
							y: 0,
						},
					},
				]);
				yield* cavernPlayerState.moveTo({
					x: 1132,
					y: 720,
				});
				yield* cavernPlayerState.setVelocity({ x: 35, y: 0 });

				yield* input.beginFrame;
				yield* cavernGameplayDirector.stepFrame();

				const resolvedPlayer = yield* cavernPlayerState.snapshot;
				const resolvedEnemies = yield* cavernEnemyState.snapshot;
				const resolvedFirstEnemy = resolvedEnemies[0];
				const resolvedSecondEnemy = resolvedEnemies[1];
				expect(resolvedFirstEnemy).toBeDefined();
				expect(resolvedSecondEnemy).toBeDefined();
				if (
					resolvedFirstEnemy === undefined ||
					resolvedSecondEnemy === undefined
				) {
					return;
				}

				expect(
					doesRectangleIntersect(
						{
							height: 92,
							width: 92,
							x: resolvedFirstEnemy.position.x,
							y: resolvedFirstEnemy.position.y,
						},
						{
							height: 92,
							width: 92,
							x: resolvedSecondEnemy.position.x,
							y: resolvedSecondEnemy.position.y,
						},
					),
				).toBe(false);
				expect(resolvedFirstEnemy.velocity.x).toBeGreaterThan(0);
				expect(resolvedSecondEnemy.velocity.x).toBeGreaterThan(5);
				expect(resolvedPlayer.velocity.x).toBeGreaterThan(0);

				const frame = yield* cavernPresentationDirector.renderFrame();
				expect(
					frame.commands.some(
						(command) =>
							command.type === "draw-image" &&
							command.imageId === "enemy-flyer-body",
					),
				).toBe(true);
				expect(
					frame.commands.some(
						(command) =>
							command.type === "draw-image" &&
							command.imageId === "enemy-flyer-eye",
					),
				).toBe(true);
			}),
		);
	});
});
