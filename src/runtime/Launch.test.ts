import { describe, expect, test } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import { NativeBoundary } from "../native/NativeBoundary.ts";
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

const testNativeBoundaryLayer = Layer.effect(NativeBoundary)(
	Effect.succeed(
		NativeBoundary.of({
			diagnostics: Effect.succeed({
				audio: {
					activeSoundCount: 0,
					backend: "test",
					currentMusicCueId: null,
					supportsLoopingMusic: false,
					supportsPauseResume: false,
					supportsPitch: false,
					supportsVolume: false,
				},
				initialized: false,
				inputEventCount: 0,
				lastError: null,
				renderer: {
					backend: "test",
					frameCount: 0,
					supportsBlendModes: ["alpha"],
					supportsImages: false,
					supportsText: false,
				},
				timing: {
					backend: "test",
					frameDelayMillis: 0,
				},
				window: null,
			}),
			initialize: () => Effect.void,
			shutdown: Effect.void,
		}),
	),
);

describe("Launch", () => {
	test("composes engine runtime services into one launch layer", async () => {
		await runLayerEffect(
			makeRuntimeLayer(
				{
					...defaultEngineConfig,
					gameId: "effect2d/test-game",
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

				yield* engine.launch();
				yield* clock.beginFrame();

				expect(engine.config.gameId).toBe("effect2d/test-game");
				expect(random.seed).toBe(12345);
				expect((yield* clock.snapshot()).frameCount).toBe(1);
			}),
		);
	});

	test("surfaces launch failure from the native boundary through the engine program", async () => {
		const exit = await runLayerEffect(
			makeRuntimeLayer(defaultEngineConfig, {
				nativeBoundaryLayer: NativeBoundary.unimplemented,
			}),
			Effect.exit(engineProgram),
		);

		expect(Exit.isFailure(exit)).toBe(true);
	});

	test("runs the seeded engine program against a runtime layer that exposes the configured seed", async () => {
		await runLayerEffect(
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
		);
	});
});
