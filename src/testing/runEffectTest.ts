import { Effect, Layer } from "effect";

export const runEffectTest = <Success, Failure>(
	effect: Effect.Effect<Success, Failure>,
): Promise<Success> => Effect.runPromise(effect);

export const runLayerEffect = async <
	Success,
	EffectFailure,
	LayerFailure,
	Services,
>(
	layer: Layer.Layer<Services, LayerFailure>,
	effect: Effect.Effect<Success, EffectFailure, Services>,
): Promise<Success> => {
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const services = yield* Layer.build(layer);
				return yield* Effect.provideServices(effect, services);
			}),
		),
	);
};
