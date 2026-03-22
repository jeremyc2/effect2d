import { Effect, Layer, ServiceMap } from "effect";

import { Audio } from "../audio/Audio.ts";
import { EngineLaunchError } from "../errors/EngineError.ts";
import { Input } from "../input/Input.ts";
import {
	NativeBackend,
	type NativeBackendDiagnostics,
} from "./NativeBackend.ts";
import { NativeFrameSource } from "./NativeFrameSource.ts";

export class NativeBoundary extends ServiceMap.Service<
	NativeBoundary,
	{
		readonly diagnostics: Effect.Effect<NativeBackendDiagnostics>;
		readonly initialize: (
			gameId: string,
		) => Effect.Effect<void, EngineLaunchError>;
		readonly shutdown: Effect.Effect<void>;
	}
>()("effect2d/native/NativeBoundary") {
	static readonly layer = Layer.effect(
		NativeBoundary,
		Effect.gen(function* () {
			const audio = yield* Audio;
			const input = yield* Input;
			const nativeBackend = yield* NativeBackend;
			const frameSource = yield* NativeFrameSource;

			const initialize = Effect.fn("NativeBoundary.initialize")(function* (
				gameId: string,
			) {
				yield* nativeBackend.open(gameId);

				try {
					while ((yield* nativeBackend.diagnostics).initialized) {
						yield* input.beginFrame;

						for (const event of yield* nativeBackend.drainInputEvents) {
							yield* input.applyEvent(event);
						}

						const frame = yield* frameSource.nextFrame;
						for (const playbackId of yield* nativeBackend.syncAudio(
							yield* audio.snapshot,
						)) {
							yield* audio.completeSound(playbackId);
						}
						yield* nativeBackend.presentFrame(frame);
						yield* nativeBackend.waitForNextFrame;
					}
				} finally {
					yield* nativeBackend.close;
				}
			});

			return NativeBoundary.of({
				diagnostics: nativeBackend.diagnostics,
				initialize,
				shutdown: nativeBackend.close,
			});
		}),
	);

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
				diagnostics: Effect.succeed({
					audio: {
						activeSoundCount: 0,
						backend: "unimplemented",
						currentMusicCueId: null,
						supportsLoopingMusic: false,
						supportsPauseResume: false,
						supportsPitch: false,
						supportsVolume: false,
					},
					initialized: false,
					inputEventCount: 0,
					lastError: "Native boundary is not implemented.",
					renderer: {
						backend: "unimplemented",
						frameCount: 0,
						supportsBlendModes: [],
						supportsImages: false,
						supportsText: false,
					},
					timing: {
						backend: "unimplemented",
						frameDelayMillis: 0,
					},
					window: null,
				}),
				initialize,
				shutdown: Effect.void,
			});
		}),
	);
}
