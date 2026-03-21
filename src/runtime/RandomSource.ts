import { Effect, Layer, Random, ServiceMap } from "effect";

export class RandomSource extends ServiceMap.Service<
	RandomSource,
	{
		readonly seed: number | string | undefined;
		readonly next: Effect.Effect<number>;
		readonly nextBoolean: Effect.Effect<boolean>;
		readonly nextInt: Effect.Effect<number>;
		readonly nextIntBetween: (
			minimum: number,
			maximum: number,
		) => Effect.Effect<number>;
		readonly shuffle: <Value>(
			values: ReadonlyArray<Value>,
		) => Effect.Effect<Array<Value>>;
	}
>()("effect2d/runtime/RandomSource") {
	static readonly layer = (seed?: number | string) =>
		Layer.effect(
			RandomSource,
			Effect.sync(() =>
				RandomSource.of({
					seed,
					next: Random.next,
					nextBoolean: Random.nextBoolean,
					nextInt: Random.nextInt,
					nextIntBetween: (minimum: number, maximum: number) =>
						Random.nextIntBetween(minimum, maximum),
					shuffle: <Value>(values: ReadonlyArray<Value>) =>
						Random.shuffle(values),
				}),
			),
		);
}

export const withRandomSeed = <Success, Failure, Requirements>(
	effect: Effect.Effect<Success, Failure, Requirements>,
	seed?: number | string,
): Effect.Effect<Success, Failure, Requirements> =>
	seed === undefined ? effect : effect.pipe(Random.withSeed(seed));
