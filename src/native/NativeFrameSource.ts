import { type Effect, ServiceMap } from "effect";

import type { FrameSnapshot } from "../graphics/Graphics.ts";
import type { EngineLaunchError } from "../runtime/EngineError.ts";

/**
 * Produces the next authored frame for the native runtime.
 *
 * @public
 *
 * Games usually provide this service by composing gameplay and presentation
 * directors into one step that returns a {@link FrameSnapshot}.
 */
export class NativeFrameSource extends ServiceMap.Service<
	NativeFrameSource,
	{
		readonly nextFrame: Effect.Effect<FrameSnapshot, EngineLaunchError>;
	}
>()("effect2d/native/NativeFrameSource") {}
