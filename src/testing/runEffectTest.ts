import { Effect, Layer } from "effect";

export function runEffectTest<Success, Failure>(
	effect: Effect.Effect<Success, Failure>,
): Promise<Success> {
	return Effect.runPromise(effect);
}

export function layerEffect<Success, EffectFailure, LayerFailure, Services>(
	layer: Layer.Layer<Services, LayerFailure>,
	effect: Effect.Effect<Success, EffectFailure, Services>,
): Effect.Effect<Success, EffectFailure | LayerFailure> {
	return Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(layer);
			return yield* Effect.provideContext(effect, services);
		}),
	);
}

export function runLayerEffect<Success, EffectFailure, LayerFailure, Services>(
	layer: Layer.Layer<Services, LayerFailure>,
	effect: Effect.Effect<Success, EffectFailure, Services>,
): Promise<Success> {
	return Effect.runPromise(layerEffect(layer, effect));
}
