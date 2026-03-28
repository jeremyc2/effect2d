import { Effect, Layer } from "effect";

export function runEffectTest<Success, Failure>(
	effect: Effect.Effect<Success, Failure>,
): Promise<Success> {
	return Effect.runPromise(effect);
}

export async function runLayerEffect<
	Success,
	EffectFailure,
	LayerFailure,
	Services,
>(
	layer: Layer.Layer<Services, LayerFailure>,
	effect: Effect.Effect<Success, EffectFailure, Services>,
): Promise<Success> {
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const services = yield* Layer.build(layer);
				return yield* Effect.provideServices(effect, services);
			}),
		),
	);
}
