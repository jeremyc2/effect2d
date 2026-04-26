import { Context, type Effect } from "effect";

import type { AudioSnapshot } from "../audio/Audio.ts";
import type { FrameSnapshot } from "../graphics/Graphics.ts";
import type { InputEvent } from "../input/Input.ts";
import type { EngineLaunchError } from "../runtime/EngineError.ts";

/** Window state exposed by the platform backend. @public */
export interface PlatformWindowSnapshot {
	readonly backend: string;
	readonly height: number;
	readonly isOpen: boolean;
	readonly pixelHeight: number;
	readonly pixelWidth: number;
	readonly title: string;
	readonly width: number;
}

/** Renderer capabilities and counters from the platform backend. @public */
export interface PlatformRendererSnapshot {
	readonly backend: string;
	readonly frameCount: number;
	readonly supportsBlendModes: ReadonlyArray<"add" | "alpha" | "multiply">;
	readonly supportsImages: boolean;
	readonly supportsText: boolean;
}

/** Audio output capabilities and playback state from the platform backend. @public */
export interface PlatformAudioOutputSnapshot {
	readonly activeSoundCount: number;
	readonly backend: string;
	readonly currentMusicCueId: string | null;
	readonly supportsLoopingMusic: boolean;
	readonly supportsPauseResume: boolean;
	readonly supportsPitch: boolean;
	readonly supportsVolume: boolean;
}

/** Frame pacing information from the platform backend. @public */
export interface PlatformTimingSnapshot {
	readonly backend: string;
	readonly frameDelayMillis: number;
}

/**
 * Combined diagnostic snapshot for the active platform backend.
 *
 * @public
 *
 * Startup diagnostics, tests, and debug overlays use this to inspect
 * renderer, audio, timing, and window state together.
 */
export interface PlatformBackendDiagnostics {
	readonly audio: PlatformAudioOutputSnapshot;
	readonly initialized: boolean;
	readonly inputEventCount: number;
	readonly lastError: string | null;
	readonly renderer: PlatformRendererSnapshot;
	readonly timing: PlatformTimingSnapshot;
	readonly window: PlatformWindowSnapshot | null;
}

/**
 * Swappable OS-facing adapter: windowing, presentation, input drain, audio device sync.
 *
 * @public
 *
 * Most games do not implement `PlatformBackend` directly. Use
 * {@link makeSkiaNativeBoundaryLayer}, which wires a concrete backend into the
 * **Native boundary** and keeps **Frame updater** work in game land.
 */
export class PlatformBackend extends Context.Service<
	PlatformBackend,
	{
		readonly close: Effect.Effect<void>;
		readonly diagnostics: Effect.Effect<PlatformBackendDiagnostics>;
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
>()("effect2d/native/PlatformBackend") {}
