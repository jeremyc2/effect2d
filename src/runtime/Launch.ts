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

/**
 * Builds the smallest engine layer necessary to launch through a native
 * boundary.
 *
 * @public
 *
 * Use this when you already know which additional services you want to provide
 * yourself and only need the validated {@link Engine} service.
 */
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

/**
 * Builds the standard runtime layer for most games.
 *
 * @public
 *
 * This is the usual starting point for application authors. It bundles the
 * validated {@link Engine}, a deterministic {@link RandomSource}, and a
 * fixed-step {@link RuntimeClock}. Most games merge this layer with their own
 * state, scene, input, audio, graphics, and native frame services.
 */
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

/**
 * Launches the active {@link Engine} from the environment.
 *
 * @public
 *
 * This program is useful when your surrounding application has already built
 * and provided an `Engine` service.
 */
export const engineProgram: Effect.Effect<void, EngineLaunchError, Engine> =
	Effect.gen(function* () {
		const engine = yield* Engine;
		yield* engine.launch();
	});

/**
 * Launches the active engine while temporarily overriding randomness with the
 * provided config seed.
 *
 * @public
 *
 * This is primarily useful for reproducible demos, tests, recordings, and
 * deterministic debugging sessions.
 */
export const seededEngineProgram = (
	config: EngineConfig,
): Effect.Effect<void, EngineLaunchError, Engine> =>
	withRandomSeed(engineProgram, config.randomSeed);
