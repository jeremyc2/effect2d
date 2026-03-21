import { Effect, Layer, ServiceMap } from "effect";

import { EngineLaunchError } from "../errors/EngineError.ts";

export class NativeBoundary extends ServiceMap.Service<
	NativeBoundary,
	{
		readonly initialize: (
			gameId: string,
		) => Effect.Effect<void, EngineLaunchError>;
		readonly shutdown: Effect.Effect<void>;
	}
>()("effect2d/native/NativeBoundary") {
	static readonly unimplemented = Layer.effect(
		NativeBoundary,
		Effect.sync(() => {
			const initialize = Effect.fn("NativeBoundary.initialize")(function* (
				gameId: string,
			) {
				return yield* new EngineLaunchError({
					module: "native",
					reason: `Native boundary is not implemented for ${gameId}.`,
				});
			});

			return NativeBoundary.of({
				initialize,
				shutdown: Effect.void,
			});
		}),
	);
}
