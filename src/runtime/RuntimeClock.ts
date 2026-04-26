import { Clock, Context, Duration, Effect, Layer, Ref } from "effect";
import { recordFrameTime } from "../debug/GameplayMetrics.ts";

/**
 * Snapshot data exposed by the runtime clock.
 *
 * @public
 *
 * This is mainly useful for diagnostics, debug overlays, and tests that need
 * to assert how many fixed ticks or rendered frames have elapsed.
 */
export interface RuntimeTimingSnapshot {
	readonly fixedTickMillis: number;
	readonly frameCount: number;
	readonly lastFrameDeltaMillis: number;
	readonly lastFrameStartedAtMillis: number | null;
	readonly tickCount: number;
}

interface RuntimeClockState {
	readonly frameCount: number;
	readonly lastFrameDeltaMillis: number;
	readonly lastFrameStartedAtMillis: number | null;
	readonly tickCount: number;
}

const initialRuntimeClockState: RuntimeClockState = {
	frameCount: 0,
	lastFrameDeltaMillis: 0,
	lastFrameStartedAtMillis: null,
	tickCount: 0,
};

/**
 * Tracks frame timing and fixed-step sleep for a running game.
 *
 * @public
 *
 * Most authored game code does not manipulate time directly. Instead, the
 * runtime uses `RuntimeClock` to:
 *
 * - mark the start of each rendered frame with `beginFrame()`
 * - count fixed simulation ticks with `advanceTick()`
 * - expose timing data through `snapshot()`
 * - sleep for one configured fixed step with `sleepFixedStep`
 *
 * This keeps frame pacing and diagnostics reproducible in tests while still
 * giving tools a simple place to read current timing state.
 */
export class RuntimeClock extends Context.Service<
	RuntimeClock,
	{
		readonly currentTimeMillis: Effect.Effect<number>;
		readonly beginFrame: () => Effect.Effect<void>;
		readonly advanceTick: () => Effect.Effect<void>;
		readonly reset: () => Effect.Effect<void>;
		readonly sleepFixedStep: Effect.Effect<void>;
		readonly snapshot: () => Effect.Effect<RuntimeTimingSnapshot>;
	}
>()("effect2d/runtime/RuntimeClock") {
	static readonly layer = (targetTicksPerSecond: number) =>
		Layer.effect(
			RuntimeClock,
			Effect.gen(function* () {
				const state = yield* Ref.make(initialRuntimeClockState);
				const fixedTickMillis = 1_000 / targetTicksPerSecond;

				const beginFrame = Effect.fn("RuntimeClock.beginFrame")(function* () {
					const now = yield* Clock.currentTimeMillis;
					const previousFrameStartedAtMillis = yield* Ref.modify(
						state,
						(current) =>
							[
								current.lastFrameStartedAtMillis,
								{
									frameCount: current.frameCount + 1,
									lastFrameDeltaMillis:
										current.lastFrameStartedAtMillis === null
											? 0
											: now - current.lastFrameStartedAtMillis,
									lastFrameStartedAtMillis: now,
									tickCount: current.tickCount,
								},
							] as const,
					);
					if (previousFrameStartedAtMillis !== null) {
						yield* recordFrameTime(now - previousFrameStartedAtMillis);
					}
				});

				const advanceTick = Effect.fn("RuntimeClock.advanceTick")(function* () {
					yield* Ref.update(state, (current) => ({
						...current,
						tickCount: current.tickCount + 1,
					}));
				});

				const reset = Effect.fn("RuntimeClock.reset")(function* () {
					yield* Ref.set(state, initialRuntimeClockState);
				});

				const snapshot = Effect.fn("RuntimeClock.snapshot")(function* () {
					const current = yield* Ref.get(state);
					return {
						fixedTickMillis,
						frameCount: current.frameCount,
						lastFrameDeltaMillis: current.lastFrameDeltaMillis,
						lastFrameStartedAtMillis: current.lastFrameStartedAtMillis,
						tickCount: current.tickCount,
					};
				});

				return RuntimeClock.of({
					currentTimeMillis: Clock.currentTimeMillis,
					beginFrame,
					advanceTick,
					reset,
					sleepFixedStep: Effect.sleep(Duration.millis(fixedTickMillis)),
					snapshot,
				});
			}),
		);
}
