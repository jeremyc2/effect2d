import { type Effect, ServiceMap } from "effect";

import type { EngineLaunchError } from "../errors/EngineError.ts";
import type { FrameSnapshot } from "../graphics/Graphics.ts";

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
>()("Effect2d/native/NativeFrameSource") {}
