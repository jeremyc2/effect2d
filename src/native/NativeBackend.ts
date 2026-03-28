import { type Effect, ServiceMap } from "effect";

import type { AudioSnapshot } from "../audio/Audio.ts";
import type { FrameSnapshot } from "../graphics/Graphics.ts";
import type { InputEvent } from "../input/Input.ts";
import type { EngineLaunchError } from "../runtime/EngineError.ts";

/** The current native window state exposed by the backend. @public */
export interface NativeWindowSnapshot {
	readonly backend: string;
	readonly height: number;
	readonly isOpen: boolean;
	readonly pixelHeight: number;
	readonly pixelWidth: number;
	readonly title: string;
	readonly width: number;
}

/** Renderer capabilities and counters exposed by the native backend. @public */
export interface NativeRendererSnapshot {
	readonly backend: string;
	readonly frameCount: number;
	readonly supportsBlendModes: ReadonlyArray<"add" | "alpha" | "multiply">;
	readonly supportsImages: boolean;
	readonly supportsText: boolean;
}

/** Native audio output capabilities and current playback state. @public */
export interface NativeAudioOutputSnapshot {
	readonly activeSoundCount: number;
	readonly backend: string;
	readonly currentMusicCueId: string | null;
	readonly supportsLoopingMusic: boolean;
	readonly supportsPauseResume: boolean;
	readonly supportsPitch: boolean;
	readonly supportsVolume: boolean;
}

/** Native frame pacing information exposed by the backend. @public */
export interface NativeTimingSnapshot {
	readonly backend: string;
	readonly frameDelayMillis: number;
}

/**
 * A combined diagnostic snapshot for the active native backend.
 *
 * @public
 *
 * This is useful for startup diagnostics, test assertions, and debug screens
 * that need to inspect renderer, audio, timing, and window state together.
 */
export interface NativeBackendDiagnostics {
	readonly audio: NativeAudioOutputSnapshot;
	readonly initialized: boolean;
	readonly inputEventCount: number;
	readonly lastError: string | null;
	readonly renderer: NativeRendererSnapshot;
	readonly timing: NativeTimingSnapshot;
	readonly window: NativeWindowSnapshot | null;
}

/**
 * Low-level native runtime adapter used by {@link NativeBoundary}.
 *
 * @public
 *
 * Most games do not implement or consume `NativeBackend` directly. Instead
 * they use a helper such as {@link makeSkiaNativeBoundaryLayer}, which wires a
 * concrete backend into {@link NativeBoundary}. This service exists so the
 * engine can separate authored frame production from platform-specific window,
 * input, rendering, and audio work.
 */
export class NativeBackend extends ServiceMap.Service<
	NativeBackend,
	{
		readonly close: Effect.Effect<void>;
		readonly diagnostics: Effect.Effect<NativeBackendDiagnostics>;
		readonly drainInputEvents: Effect.Effect<
			ReadonlyArray<InputEvent>,
			EngineLaunchError
		>;
		readonly open: (gameId: string) => Effect.Effect<void, EngineLaunchError>;
		readonly presentFrame: (
			frame: FrameSnapshot,
		) => Effect.Effect<void, EngineLaunchError>;
		readonly syncAudio: (
			snapshot: AudioSnapshot,
		) => Effect.Effect<ReadonlyArray<string>, EngineLaunchError>;
		readonly waitForNextFrame: Effect.Effect<void, EngineLaunchError>;
	}
>()("effect2d/native/NativeBackend") {}
