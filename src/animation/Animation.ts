import { type Effect, ServiceMap } from "effect";

export interface AnimationClip {
	readonly id: string;
	readonly frameCount: number;
	readonly framesPerSecond: number;
}

export class AnimationLibrary extends ServiceMap.Service<
	AnimationLibrary,
	{
		readonly play: (clipId: string) => Effect.Effect<void>;
		readonly clip: (clipId: string) => Effect.Effect<AnimationClip>;
	}
>()("effect2d/animation/Animation/AnimationLibrary") {}
