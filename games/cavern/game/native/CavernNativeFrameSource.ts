import { Effect, Exit, Layer } from "effect";
import { EngineLaunchError, NativeFrameSource } from "../../../../src/index.ts";
import { CavernGameplayDirector } from "../directors/CavernGameplayDirector.ts";
import { CavernPresentationDirector } from "../directors/CavernPresentationDirector.ts";

function createEngineLaunchError(reason: string) {
	return new EngineLaunchError({
		module: "native",
		reason,
	});
}

export const CavernNativeFrameSourceLive = Layer.effect(
	NativeFrameSource,
	Effect.gen(function* () {
		const gameplayDirector = yield* CavernGameplayDirector;
		const presentationDirector = yield* CavernPresentationDirector;

		const nextFrame = Effect.gen(function* () {
			const gameplayExit = yield* Effect.exit(gameplayDirector.stepFrame());
			if (Exit.isFailure(gameplayExit)) {
				return yield* createEngineLaunchError("Cavern gameplay frame failed.");
			}

			const renderExit = yield* Effect.exit(presentationDirector.renderFrame());
			if (Exit.isFailure(renderExit)) {
				return yield* createEngineLaunchError("Cavern render frame failed.");
			}

			return renderExit.value;
		});

		return NativeFrameSource.of({
			nextFrame,
		});
	}),
);
