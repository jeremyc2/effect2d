import { Effect, Exit, Layer } from "effect";
import { EngineLaunchError, NativeFrameSource } from "../../../../src/index.ts";
import { CavernGameplayDirector } from "../directors/CavernGameplayDirector.ts";
import { CavernPresentationDirector } from "../directors/CavernPresentationDirector.ts";

const toEngineLaunchError = (reason: string) =>
	new EngineLaunchError({
		module: "native",
		reason,
	});

export const CavernNativeFrameSourceLive = Layer.effect(
	NativeFrameSource,
	Effect.gen(function* () {
		const gameplayDirector = yield* CavernGameplayDirector;
		const presentationDirector = yield* CavernPresentationDirector;

		const nextFrame = Effect.gen(function* () {
			const gameplayExit = yield* Effect.exit(gameplayDirector.stepFrame());
			if (Exit.isFailure(gameplayExit)) {
				return yield* toEngineLaunchError("Cavern gameplay frame failed.");
			}

			const renderExit = yield* Effect.exit(presentationDirector.renderFrame());
			if (Exit.isFailure(renderExit)) {
				return yield* toEngineLaunchError("Cavern render frame failed.");
			}

			return renderExit.value;
		});

		return NativeFrameSource.of({
			nextFrame,
		});
	}),
);
