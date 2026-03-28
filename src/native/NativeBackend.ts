import { type Effect, ServiceMap } from "effect";

import type { AudioSnapshot } from "../audio/Audio.ts";
import type { EngineLaunchError } from "../errors/EngineError.ts";
import type { FrameSnapshot } from "../graphics/Graphics.ts";
import type { InputEvent } from "../input/Input.ts";

export interface NativeWindowSnapshot {
	readonly backend: string;
	readonly height: number;
	readonly isOpen: boolean;
	readonly pixelHeight: number;
	readonly pixelWidth: number;
	readonly title: string;
	readonly width: number;
}

export interface NativeRendererSnapshot {
	readonly backend: string;
	readonly frameCount: number;
	readonly supportsBlendModes: ReadonlyArray<"add" | "alpha" | "multiply">;
	readonly supportsImages: boolean;
	readonly supportsText: boolean;
}

export interface NativeAudioOutputSnapshot {
	readonly activeSoundCount: number;
	readonly backend: string;
	readonly currentMusicCueId: string | null;
	readonly supportsLoopingMusic: boolean;
	readonly supportsPauseResume: boolean;
	readonly supportsPitch: boolean;
	readonly supportsVolume: boolean;
}

export interface NativeTimingSnapshot {
	readonly backend: string;
	readonly frameDelayMillis: number;
}

export interface NativeBackendDiagnostics {
	readonly audio: NativeAudioOutputSnapshot;
	readonly initialized: boolean;
	readonly inputEventCount: number;
	readonly lastError: string | null;
	readonly renderer: NativeRendererSnapshot;
	readonly timing: NativeTimingSnapshot;
	readonly window: NativeWindowSnapshot | null;
}

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
