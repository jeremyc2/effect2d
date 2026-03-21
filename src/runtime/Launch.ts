import { Effect, Layer } from "effect";

import type {
	EngineConfigurationError,
	EngineLaunchError,
} from "../errors/EngineError.ts";
import type { NativeBoundary } from "../native/NativeBoundary.ts";
import { Engine } from "./Engine.ts";
import type { EngineConfig } from "./EngineConfig.ts";

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

export const engineProgram: Effect.Effect<void, EngineLaunchError, Engine> =
	Effect.gen(function* () {
		const engine = yield* Engine;
		yield* engine.launch();
	});
