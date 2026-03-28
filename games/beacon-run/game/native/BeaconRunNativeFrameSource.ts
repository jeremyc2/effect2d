import { Effect, Exit, Layer } from "effect";
import { EngineLaunchError, NativeFrameSource } from "../../../../src/index.ts";
import { BeaconRunGameplayDirector } from "../directors/BeaconRunGameplayDirector.ts";
import { BeaconRunPresentationDirector } from "../directors/BeaconRunPresentationDirector.ts";

function createEngineLaunchError(reason: string) {
	return new EngineLaunchError({
		module: "native",
		reason,
	});
}

export const BeaconRunNativeFrameSourceLive = Layer.effect(
	NativeFrameSource,
	Effect.gen(function* () {
		const gameplayDirector = yield* BeaconRunGameplayDirector;
		const presentationDirector = yield* BeaconRunPresentationDirector;

		const nextFrame = Effect.gen(function* () {
			const gameplayExit = yield* Effect.exit(gameplayDirector.stepFrame());
			if (Exit.isFailure(gameplayExit)) {
				return yield* createEngineLaunchError(
					"Beacon Run gameplay frame failed.",
				);
			}

			const renderExit = yield* Effect.exit(presentationDirector.renderFrame());
			if (Exit.isFailure(renderExit)) {
				return yield* createEngineLaunchError(
					"Beacon Run render frame failed.",
				);
			}

			return renderExit.value;
		});

		return NativeFrameSource.of({
			nextFrame,
		});
	}),
);
