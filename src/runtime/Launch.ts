import { Effect, Layer } from "effect";

import type {
	EngineConfigurationError,
	EngineLaunchError,
} from "../errors/EngineError.ts";
import type { NativeBoundary } from "../native/NativeBoundary.ts";
import { Engine } from "./Engine.ts";
import type { EngineConfig } from "./EngineConfig.ts";
import { RandomSource, withRandomSeed } from "./RandomSource.ts";
import { RuntimeClock } from "./RuntimeClock.ts";

export const makeEngineLayer = (
	config: EngineConfig,
	{
		nativeBoundaryLayer,
	}: {
		readonly nativeBoundaryLayer: Layer.Layer<
			NativeBoundary,
			EngineLaunchError
		>;
	},
): Layer.Layer<Engine, EngineConfigurationError | EngineLaunchError> =>
	Engine.layer(config).pipe(Layer.provide(nativeBoundaryLayer));

export const makeRuntimeLayer = (
	config: EngineConfig,
	{
		nativeBoundaryLayer,
	}: {
		readonly nativeBoundaryLayer: Layer.Layer<
			NativeBoundary,
			EngineLaunchError
		>;
	},
): Layer.Layer<
	Engine | RandomSource | RuntimeClock,
	EngineConfigurationError | EngineLaunchError
> => {
	const engineLayer = makeEngineLayer(config, { nativeBoundaryLayer });
	const runtimeClockLayer = RuntimeClock.layer(config.targetTicksPerSecond);
	const randomSourceLayer = RandomSource.layer(config.randomSeed);

	return Layer.mergeAll(engineLayer, runtimeClockLayer, randomSourceLayer);
};

export const engineProgram: Effect.Effect<void, EngineLaunchError, Engine> =
	Effect.gen(function* () {
		const engine = yield* Engine;
		yield* engine.launch();
	});

export const seededEngineProgram = (
	config: EngineConfig,
): Effect.Effect<void, EngineLaunchError, Engine> =>
	withRandomSeed(engineProgram, config.randomSeed);
