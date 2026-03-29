import { Effect, Exit, Layer } from "effect";
import { EngineLaunchError, NativeFrameSource } from "../../../../src/index.ts";
import { StarterGameplayDirector } from "../directors/StarterGameplayDirector.ts";
import { StarterPresentationDirector } from "../directors/StarterPresentationDirector.ts";

function createEngineLaunchError(reason: string) {
	return new EngineLaunchError({
		module: "native",
		reason,
	});
}

export const StarterNativeFrameSourceLive = Layer.effect(
	NativeFrameSource,
	Effect.gen(function* () {
		const gameplayDirector = yield* StarterGameplayDirector;
		const presentationDirector = yield* StarterPresentationDirector;

		const nextFrame = Effect.gen(function* () {
			const gameplayExit = yield* Effect.exit(gameplayDirector.stepFrame());
			if (Exit.isFailure(gameplayExit)) {
				return yield* createEngineLaunchError("Starter gameplay frame failed.");
			}

			const renderExit = yield* Effect.exit(presentationDirector.renderFrame());
			if (Exit.isFailure(renderExit)) {
				return yield* createEngineLaunchError("Starter render frame failed.");
			}

			return renderExit.value;
		});

		return NativeFrameSource.of({
			nextFrame,
		});
	}),
);
