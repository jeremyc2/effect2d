import { Context, type Effect } from "effect";

import type { FrameSnapshot } from "../graphics/Graphics.ts";
import type { EngineLaunchError } from "../runtime/EngineError.ts";

/**
 * Runs simulation and draw for the next frame before presentation (**Frame updater** in the glossary).
 *
 * @public
 *
 * Games provide this by composing update and draw into one step that returns a
 * {@link FrameSnapshot}.
 */
export class FrameUpdater extends Context.Service<
	FrameUpdater,
	{
		readonly nextFrame: Effect.Effect<FrameSnapshot, EngineLaunchError>;
	}
>()("effect2d/native/FrameUpdater") {}
