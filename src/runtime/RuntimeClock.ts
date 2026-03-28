import { Clock, Duration, Effect, Layer, Ref, ServiceMap } from "effect";

/** Snapshot data exposed by the runtime clock. @public */
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
 */
export class RuntimeClock extends ServiceMap.Service<
	RuntimeClock,
	{
		readonly currentTimeMillis: Effect.Effect<number>;
		readonly beginFrame: () => Effect.Effect<void>;
		readonly advanceTick: () => Effect.Effect<void>;
		readonly reset: () => Effect.Effect<void>;
		readonly sleepFixedStep: Effect.Effect<void>;
		readonly snapshot: () => Effect.Effect<RuntimeTimingSnapshot>;
	}
>()("Effect2d/runtime/RuntimeClock") {
	static readonly layer = (targetTicksPerSecond: number) =>
		Layer.effect(
			RuntimeClock,
			Effect.gen(function* () {
				const state = yield* Ref.make(initialRuntimeClockState);
				const fixedTickMillis = 1_000 / targetTicksPerSecond;

				const beginFrame = Effect.fn("RuntimeClock.beginFrame")(function* () {
					const now = yield* Clock.currentTimeMillis;
					yield* Ref.update(state, (current) => ({
						frameCount: current.frameCount + 1,
						lastFrameDeltaMillis:
							current.lastFrameStartedAtMillis === null
								? 0
								: now - current.lastFrameStartedAtMillis,
						lastFrameStartedAtMillis: now,
						tickCount: current.tickCount,
					}));
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
