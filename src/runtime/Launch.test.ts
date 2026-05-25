import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { NativeBoundary } from "../native/NativeBoundary.ts";
import { headlessNativeBoundaryLayer } from "../testing/index.ts";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { Engine } from "./Engine.ts";
import { defaultEngineConfig } from "./EngineConfig.ts";
import {
	engineProgram,
	makeRuntimeLayer,
	seededEngineProgram,
} from "./Launch.ts";
import { RandomSource } from "./RandomSource.ts";
import { RuntimeClock } from "./RuntimeClock.ts";

const testNativeBoundaryLayer = headlessNativeBoundaryLayer;

describe("Launch", () => {
	test("composes engine runtime services into one launch layer", () =>
		runLayerEffect(
			makeRuntimeLayer(
				{
					...defaultEngineConfig,
					gameId: "Effect2d/test-game",
					randomSeed: 12345,
					startScene: "boot",
					targetTicksPerSecond: 60,
				},
				{
					nativeBoundaryLayer: testNativeBoundaryLayer,
				},
			),
			Effect.gen(function* () {
				const engine = yield* Engine;
				const random = yield* RandomSource;
				const clock = yield* RuntimeClock;

				yield* engine.launch;
				yield* clock.beginFrame;

				expect(engine.config.gameId).toBe("Effect2d/test-game");
				expect(random.seed).toBe(12345);
				expect((yield* clock.snapshot).frameCount).toBe(1);
			}),
		));

	test("surfaces launch failure from the native boundary through the engine program", () =>
		runLayerEffect(
			makeRuntimeLayer(defaultEngineConfig, {
				nativeBoundaryLayer: NativeBoundary.unimplemented,
			}),
			Effect.gen(function* () {
				const exit = yield* Effect.exit(engineProgram);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		));

	test("runs the seeded engine program against a runtime layer that exposes the configured seed", () =>
		runLayerEffect(
			makeRuntimeLayer(
				{
					...defaultEngineConfig,
					randomSeed: "demo-seed",
				},
				{
					nativeBoundaryLayer: testNativeBoundaryLayer,
				},
			),
			seededEngineProgram({
				...defaultEngineConfig,
				randomSeed: "demo-seed",
			}).pipe(
				Effect.andThen(
					Effect.gen(function* () {
						const random = yield* RandomSource;
						expect(random.seed).toBe("demo-seed");
					}),
				),
			),
		));
});
