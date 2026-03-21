import { type Effect, ServiceMap } from "effect";

export class Audio extends ServiceMap.Service<
	Audio,
	{
		readonly playMusic: (cue: string) => Effect.Effect<void>;
		readonly playSound: (cue: string) => Effect.Effect<void>;
		readonly stopAll: Effect.Effect<void>;
	}
>()("effect2d/audio/Audio") {}
