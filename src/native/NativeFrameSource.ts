import { type Effect, ServiceMap } from "effect";

import type { EngineLaunchError } from "../errors/EngineError.ts";
import type { FrameSnapshot } from "../graphics/Graphics.ts";

export class NativeFrameSource extends ServiceMap.Service<
	NativeFrameSource,
	{
		readonly nextFrame: Effect.Effect<FrameSnapshot, EngineLaunchError>;
	}
>()("effect2d/native/NativeFrameSource") {}
