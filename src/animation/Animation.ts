import { Effect, Layer, Schema, ServiceMap } from "effect";

export interface AnimationClip<Frame = number> {
	readonly frames: ReadonlyArray<Frame>;
	readonly framesPerSecond: number;
	readonly id: string;
}

export type AnimationPlaybackMode = "loop" | "once";

export type AnimationDirection = "forward" | "reverse";

export interface AnimationPlaybackState<Frame = number> {
	readonly clip: AnimationClip<Frame>;
	readonly direction: AnimationDirection;
	readonly elapsedSeconds: number;
	readonly frameIndex: number;
	readonly isPlaying: boolean;
	readonly mode: AnimationPlaybackMode;
	readonly speed: number;
}

export interface AnimationTransition<Frame = number> {
	readonly nextClipId: string;
	readonly preservePlayback?: boolean;
	readonly state: AnimationPlaybackState<Frame>;
}

export class AnimationClipNotFoundError extends Schema.TaggedErrorClass<AnimationClipNotFoundError>()(
	"AnimationClipNotFoundError",
	{
		clipId: Schema.String,
	},
) {}

export interface ScalarTweenState {
	readonly durationSeconds: number;
	readonly elapsedSeconds: number;
	readonly easing: TweenEasing;
	readonly from: number;
	readonly isComplete: boolean;
	readonly to: number;
}

export interface Vec2 {
	readonly x: number;
	readonly y: number;
}

export interface Vec2TweenState {
	readonly durationSeconds: number;
	readonly elapsedSeconds: number;
	readonly easing: TweenEasing;
	readonly from: Vec2;
	readonly isComplete: boolean;
	readonly to: Vec2;
}

export type TweenEasing = "ease-in-out-quad" | "linear";

const clamp = (value: number, minimum: number, maximum: number): number =>
	Math.min(maximum, Math.max(minimum, value));

const normalizePlaybackIndex = (
	frameCount: number,
	frameIndex: number,
): number => {
	if (frameCount <= 1) {
		return 0;
	}

	const wrappedIndex = frameIndex % frameCount;
	return wrappedIndex < 0 ? wrappedIndex + frameCount : wrappedIndex;
};

const playbackRate = (direction: AnimationDirection, speed: number): number =>
	(direction === "forward" ? 1 : -1) * Math.max(speed, 0);

const applyEasing = (easing: TweenEasing, t: number): number => {
	switch (easing) {
		case "ease-in-out-quad":
			return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
		case "linear":
			return t;
	}
};

export const defineAnimationClip = <Frame>(
	clip: AnimationClip<Frame>,
): AnimationClip<Frame> => clip;

export const startAnimation = <Frame>(
	clip: AnimationClip<Frame>,
	options?: {
		readonly direction?: AnimationDirection;
		readonly mode?: AnimationPlaybackMode;
		readonly speed?: number;
	},
): AnimationPlaybackState<Frame> => ({
	clip,
	direction: options?.direction ?? "forward",
	elapsedSeconds: 0,
	frameIndex:
		(options?.direction ?? "forward") === "forward"
			? 0
			: Math.max(clip.frames.length - 1, 0),
	isPlaying: true,
	mode: options?.mode ?? "loop",
	speed: options?.speed ?? 1,
});

export const currentAnimationFrame = <Frame>(
	state: AnimationPlaybackState<Frame>,
): Frame => state.clip.frames[state.frameIndex] as Frame;

export const pauseAnimation = <Frame>(
	state: AnimationPlaybackState<Frame>,
): AnimationPlaybackState<Frame> => ({
	...state,
	isPlaying: false,
});

export const resumeAnimation = <Frame>(
	state: AnimationPlaybackState<Frame>,
): AnimationPlaybackState<Frame> => ({
	...state,
	isPlaying: true,
});

export const setAnimationDirection = <Frame>(
	state: AnimationPlaybackState<Frame>,
	direction: AnimationDirection,
): AnimationPlaybackState<Frame> => ({
	...state,
	direction,
});

export const setAnimationSpeed = <Frame>(
	state: AnimationPlaybackState<Frame>,
	speed: number,
): AnimationPlaybackState<Frame> => ({
	...state,
	speed: Math.max(speed, 0),
});

export const advanceAnimation = <Frame>(
	state: AnimationPlaybackState<Frame>,
	deltaSeconds: number,
): AnimationPlaybackState<Frame> => {
	if (!state.isPlaying || state.clip.frames.length <= 1 || deltaSeconds <= 0) {
		return state;
	}

	const frameDurationSeconds = 1 / state.clip.framesPerSecond;
	const totalFramesAdvanced =
		(state.elapsedSeconds +
			deltaSeconds * playbackRate(state.direction, state.speed)) /
		frameDurationSeconds;
	const nextFrameIndex = Math.trunc(totalFramesAdvanced);
	const tentativeFrameIndex =
		(state.direction === "forward" ? 0 : state.clip.frames.length - 1) +
		nextFrameIndex;

	if (state.mode === "once") {
		const clampedFrameIndex = clamp(
			tentativeFrameIndex,
			0,
			state.clip.frames.length - 1,
		);
		const isComplete =
			(state.direction === "forward" &&
				clampedFrameIndex === state.clip.frames.length - 1) ||
			(state.direction === "reverse" && clampedFrameIndex === 0);

		return {
			...state,
			elapsedSeconds:
				state.elapsedSeconds +
				deltaSeconds * playbackRate(state.direction, state.speed),
			frameIndex: clampedFrameIndex,
			isPlaying: isComplete ? false : state.isPlaying,
		};
	}

	return {
		...state,
		elapsedSeconds:
			state.elapsedSeconds +
			deltaSeconds * playbackRate(state.direction, state.speed),
		frameIndex: normalizePlaybackIndex(
			state.clip.frames.length,
			tentativeFrameIndex,
		),
	};
};

export const transitionAnimation = <Frame>(
	currentState: AnimationPlaybackState<Frame>,
	nextClip: AnimationClip<Frame>,
	options?: {
		readonly preservePlayback?: boolean;
	},
): AnimationTransition<Frame> => ({
	nextClipId: nextClip.id,
	state:
		options?.preservePlayback === true
			? {
					...startAnimation(nextClip, {
						direction: currentState.direction,
						mode: currentState.mode,
						speed: currentState.speed,
					}),
					elapsedSeconds: currentState.elapsedSeconds,
				}
			: startAnimation(nextClip, {
					direction: currentState.direction,
					mode: currentState.mode,
					speed: currentState.speed,
				}),
	preservePlayback: options?.preservePlayback ?? false,
});

export const startScalarTween = (
	from: number,
	to: number,
	durationSeconds: number,
	easing: TweenEasing = "linear",
): ScalarTweenState => ({
	durationSeconds: Math.max(durationSeconds, 0),
	elapsedSeconds: 0,
	easing,
	from,
	isComplete: durationSeconds <= 0,
	to,
});

export const scalarTweenValue = (state: ScalarTweenState): number => {
	if (state.durationSeconds <= 0) {
		return state.to;
	}

	const progress = clamp(state.elapsedSeconds / state.durationSeconds, 0, 1);
	return (
		state.from + (state.to - state.from) * applyEasing(state.easing, progress)
	);
};

export const advanceScalarTween = (
	state: ScalarTweenState,
	deltaSeconds: number,
): ScalarTweenState => {
	if (state.isComplete || deltaSeconds <= 0) {
		return state;
	}

	const elapsedSeconds = Math.min(
		state.elapsedSeconds + deltaSeconds,
		state.durationSeconds,
	);

	return {
		...state,
		elapsedSeconds,
		isComplete: elapsedSeconds >= state.durationSeconds,
	};
};

export const startVec2Tween = (
	from: Vec2,
	to: Vec2,
	durationSeconds: number,
	easing: TweenEasing = "linear",
): Vec2TweenState => ({
	durationSeconds: Math.max(durationSeconds, 0),
	elapsedSeconds: 0,
	easing,
	from,
	isComplete: durationSeconds <= 0,
	to,
});

export const vec2TweenValue = (state: Vec2TweenState): Vec2 => {
	if (state.durationSeconds <= 0) {
		return state.to;
	}

	const progress = clamp(state.elapsedSeconds / state.durationSeconds, 0, 1);
	const easedProgress = applyEasing(state.easing, progress);

	return {
		x: state.from.x + (state.to.x - state.from.x) * easedProgress,
		y: state.from.y + (state.to.y - state.from.y) * easedProgress,
	};
};

export const advanceVec2Tween = (
	state: Vec2TweenState,
	deltaSeconds: number,
): Vec2TweenState => {
	if (state.isComplete || deltaSeconds <= 0) {
		return state;
	}

	const elapsedSeconds = Math.min(
		state.elapsedSeconds + deltaSeconds,
		state.durationSeconds,
	);

	return {
		...state,
		elapsedSeconds,
		isComplete: elapsedSeconds >= state.durationSeconds,
	};
};

export const fadeTween = (
	fromOpacity: number,
	toOpacity: number,
	durationSeconds: number,
): ScalarTweenState =>
	startScalarTween(fromOpacity, toOpacity, durationSeconds, "linear");

export const flashTween = (
	peakIntensity: number,
	durationSeconds: number,
): ScalarTweenState =>
	startScalarTween(peakIntensity, 0, durationSeconds, "ease-in-out-quad");

export class AnimationLibrary extends ServiceMap.Service<
	AnimationLibrary,
	{
		readonly clip: <Frame = number>(
			clipId: string,
		) => Effect.Effect<AnimationClip<Frame>, AnimationClipNotFoundError>;
		readonly start: <Frame = number>(
			clipId: string,
			options?: {
				readonly direction?: AnimationDirection;
				readonly mode?: AnimationPlaybackMode;
				readonly speed?: number;
			},
		) => Effect.Effect<
			AnimationPlaybackState<Frame>,
			AnimationClipNotFoundError
		>;
	}
>()("effect2d/animation/Animation/AnimationLibrary") {
	static readonly layer = (
		clips: ReadonlyArray<AnimationClip>,
	): Layer.Layer<AnimationLibrary> =>
		Layer.sync(AnimationLibrary, () => {
			const clipsById = new Map(clips.map((clip) => [clip.id, clip]));

			const clip = Effect.fn("AnimationLibrary.clip")(function* <
				Frame = number,
			>(clipId: string) {
				const animationClip = clipsById.get(clipId);
				if (animationClip === undefined) {
					return yield* new AnimationClipNotFoundError({ clipId });
				}

				return animationClip as AnimationClip<Frame>;
			});

			const start = Effect.fn("AnimationLibrary.start")(function* <
				Frame = number,
			>(
				clipId: string,
				options?: {
					readonly direction?: AnimationDirection;
					readonly mode?: AnimationPlaybackMode;
					readonly speed?: number;
				},
			) {
				const animationClip = yield* clip<Frame>(clipId);
				return startAnimation(animationClip, options);
			});

			return AnimationLibrary.of({
				clip,
				start,
			});
		});
}
