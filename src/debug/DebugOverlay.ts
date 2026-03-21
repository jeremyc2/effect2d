import { type Effect, ServiceMap } from "effect";

export class DebugOverlay extends ServiceMap.Service<
	DebugOverlay,
	{
		readonly toggle: Effect.Effect<void>;
		readonly draw: Effect.Effect<void>;
	}
>()("effect2d/debug/DebugOverlay") {}
