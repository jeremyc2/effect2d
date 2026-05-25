import { Effect, Layer } from "effect";
import { NativeBoundary } from "../native/NativeBoundary.ts";

export const headlessNativeBoundaryLayer = Layer.effect(NativeBoundary)(
	Effect.succeed(
		NativeBoundary.of({
			diagnostics: Effect.succeed({
				audio: {
					activeSoundCount: 0,
					backend: "headless",
					currentMusicCueId: null,
					supportsLoopingMusic: false,
					supportsPauseResume: false,
					supportsPitch: false,
					supportsVolume: false,
				},
				initialized: false,
				inputEventCount: 0,
				lastError: null,
				renderer: {
					backend: "headless",
					frameCount: 0,
					supportsBlendModes: ["alpha"],
					supportsImages: false,
					supportsText: false,
				},
				timing: {
					backend: "headless",
					frameDelayMillis: 0,
				},
				window: null,
			}),
			initialize: () => Effect.void,
			shutdown: Effect.void,
		}),
	),
);
