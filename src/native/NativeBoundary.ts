import { Effect, Layer, ServiceMap } from "effect";

import { Audio } from "../audio/Audio.ts";
import { Input } from "../input/Input.ts";
import { EngineLaunchError } from "../runtime/EngineError.ts";
import { FrameUpdater } from "./FrameUpdater.ts";
import {
	PlatformBackend,
	type PlatformBackendDiagnostics,
} from "./PlatformBackend.ts";

/**
 * The **Native boundary**: OS edge orchestration between game services and the
 * platform.
 *
 * `NativeBoundary` owns the real-time launch loop for a native build. It is
 * responsible for:
 *
 * - opening the {@link PlatformBackend}
 * - collecting raw input events and applying them to {@link Input}
 * - asking the active {@link FrameUpdater} for the next frame
 * - synchronizing audio state with the platform backend
 * - presenting frames and waiting for the next step
 *
 * Most games do not implement this service directly. Use
 * {@link makeSkiaNativeBoundaryLayer}.
 */
export class NativeBoundary extends ServiceMap.Service<
	NativeBoundary,
	{
		readonly diagnostics: Effect.Effect<PlatformBackendDiagnostics>;
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
			const platformBackend = yield* PlatformBackend;
			const frameUpdater = yield* FrameUpdater;

			const awaitInitialized: (
				remainingPolls: number,
			) => Effect.Effect<void, EngineLaunchError> = Effect.fn(
				"NativeBoundary.awaitInitialized",
			)(function* (remainingPolls: number) {
				const diagnostics = yield* platformBackend.diagnostics;
				if (diagnostics.initialized) {
					return;
				}

				if (diagnostics.lastError !== null) {
					return yield* new EngineLaunchError({
						module: "native",
						reason: diagnostics.lastError,
					});
				}

				if (remainingPolls <= 0) {
					return yield* new EngineLaunchError({
						module: "native",
						reason:
							"Platform backend did not report an initialized window before launch timed out.",
					});
				}

				yield* Effect.sleep("16 millis");
				return yield* awaitInitialized(remainingPolls - 1);
			});

			const initialize = Effect.fn("NativeBoundary.initialize")(function* (
				gameId: string,
			) {
				yield* platformBackend.open(gameId);
				yield* awaitInitialized(120);

				yield* Effect.gen(function* () {
					while ((yield* platformBackend.diagnostics).initialized) {
						yield* input.beginFrame;

						for (const event of yield* platformBackend.drainInputEvents) {
							yield* input.applyEvent(event);
						}

						const frame = yield* frameUpdater.nextFrame;
						for (const playbackId of yield* platformBackend.syncAudio(
							yield* audio.snapshot,
						)) {
							yield* audio.completeSound(playbackId);
						}
						yield* platformBackend.presentFrame(frame);
						yield* platformBackend.waitForNextFrame;
					}
				}).pipe(Effect.ensuring(platformBackend.close));
			});

			return NativeBoundary.of({
				diagnostics: platformBackend.diagnostics,
				initialize,
				shutdown: platformBackend.close,
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
