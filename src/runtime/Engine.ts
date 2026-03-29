import { Effect, Layer, ServiceMap } from "effect";
import { NativeBoundary } from "../native/NativeBoundary.ts";
import type { EngineConfig } from "./EngineConfig.ts";
import {
	EngineConfigurationError,
	type EngineLaunchError,
} from "./EngineError.ts";

/**
 * The smallest runnable engine surface.
 *
 * @public
 *
 * `Engine` is the service most applications eventually launch, but it is not
 * usually the first thing authors wire by hand. In a typical game you compose
 * a runtime with {@link makeRuntimeLayer}, register your authored services, and
 * then call `engine.launch()` or use {@link engineProgram}.
 *
 * This service intentionally stays narrow:
 *
 * - `config` exposes the validated engine configuration
 * - `launch()` delegates to the active native runtime boundary
 *
 * Everything else that feels "game-like" lives in sibling services such as
 * {@link Graphics}, {@link Input}, {@link Audio}, {@link SceneDirector}, and
 * your own game-specific state services.
 */
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
					yield* Effect.annotateCurrentSpan({
						"effect2d.engine.game_id": config.gameId,
						"effect2d.engine.random_seed": config.randomSeed,
						"effect2d.engine.start_scene": config.startScene,
						"effect2d.engine.target_tps": config.targetTicksPerSecond,
					});
					yield* Effect.logInfo("Launching engine runtime.").pipe(
						Effect.annotateLogs({
							"effect2d.engine.game_id": config.gameId,
							"effect2d.engine.start_scene": config.startScene,
							"effect2d.engine.target_tps": config.targetTicksPerSecond,
						}),
					);
					yield* nativeBoundary.initialize(config.gameId);
				});

				return Engine.of({
					config,
					launch,
				});
			}),
		);
}
