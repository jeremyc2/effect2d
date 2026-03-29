import { describe, expect, it, test } from "bun:test";
import { Effect, Layer } from "effect";
import { Engine, Input, SceneDirector } from "../../src/index.ts";
import { runLayerEffect } from "../../src/testing/runEffectTest.ts";
import {
	CavernLive,
	cavernBootstrap,
	cavernProgram,
} from "./game/CavernGame.ts";
import { CavernGameplayDirector } from "./game/directors/CavernGameplayDirector.ts";
import { CavernPresentationDirector } from "./game/directors/CavernPresentationDirector.ts";
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
});
