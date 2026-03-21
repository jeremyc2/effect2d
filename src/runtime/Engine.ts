import { Effect, Layer, ServiceMap } from "effect";

import {
	EngineConfigurationError,
	type EngineLaunchError,
} from "../errors/EngineError.ts";
import { NativeBoundary } from "../native/NativeBoundary.ts";
import type { EngineConfig } from "./EngineConfig.ts";

export class Engine extends ServiceMap.Service<
	Engine,
	{
		readonly config: EngineConfig;
		readonly launch: () => Effect.Effect<void, EngineLaunchError>;
	}
>()("effect2d/runtime/Engine") {
	static readonly layer = (config: EngineConfig) =>
		Layer.effect(
			Engine,
			Effect.gen(function* () {
				if (config.gameId.length === 0) {
					return yield* new EngineConfigurationError({
						field: "gameId",
						reason: "Engine config must include a non-empty game id.",
					});
				}

				if (config.targetTicksPerSecond <= 0) {
					return yield* new EngineConfigurationError({
						field: "targetTicksPerSecond",
						reason: "Fixed timestep must be greater than zero.",
					});
				}

				const nativeBoundary = yield* NativeBoundary;
				const launch = Effect.fn("Engine.launch")(function* () {
					yield* nativeBoundary.initialize(config.gameId);
				});

				return Engine.of({
					config,
					launch,
				});
			}),
		);
}
