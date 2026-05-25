import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { RuntimeClock } from "./RuntimeClock.ts";

describe("RuntimeClock", () => {
	test("tracks frame deltas and tick count deterministically", () =>
		runLayerEffect(
			Layer.mergeAll(RuntimeClock.layer(60), TestClock.layer()),
			Effect.gen(function* () {
				const runtimeClock = yield* RuntimeClock;

				expect(yield* runtimeClock.snapshot).toEqual({
					fixedTickMillis: 1_000 / 60,
					frameCount: 0,
					lastFrameDeltaMillis: 0,
					lastFrameStartedAtMillis: null,
					tickCount: 0,
				});

				yield* runtimeClock.beginFrame;
				yield* TestClock.adjust(16);
				yield* runtimeClock.advanceTick;
				yield* runtimeClock.beginFrame;

				expect(yield* runtimeClock.snapshot).toEqual({
					fixedTickMillis: 1_000 / 60,
					frameCount: 2,
					lastFrameDeltaMillis: 16,
					lastFrameStartedAtMillis: 16,
					tickCount: 1,
				});

				yield* runtimeClock.reset;

				expect(yield* runtimeClock.snapshot).toEqual({
					fixedTickMillis: 1_000 / 60,
					frameCount: 0,
					lastFrameDeltaMillis: 0,
					lastFrameStartedAtMillis: null,
					tickCount: 0,
				});
			}),
		));
});
