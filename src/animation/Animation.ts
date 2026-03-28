import { Effect, Layer, Schema, ServiceMap } from "effect";

/**
 * Author-time description of a named clip.
 *
 * @public
 *
 * `Frame` is intentionally generic so the same helper can drive sprite-sheet
 * frame indices, texture ids, or richer authored frame payloads.
 *
 * ```ts
 * const walk = defineAnimationClip({
 *   id: "walk",
 *   frames: [0, 1, 2, 3],
 *   framesPerSecond: 12,
 * });
 * ```
 */
export interface AnimationClip<Frame = number> {
	readonly frames: ReadonlyArray<Frame>;
	readonly framesPerSecond: number;
	readonly id: string;
}

/** Playback behavior for the ends of a clip. `loop` wraps, `once` stops. @public */
export type AnimationPlaybackMode = "loop" | "once";

/** Direction the clip advances through its `frames` array. @public */
export type AnimationDirection = "forward" | "reverse";

/**
 * Runtime state for a playing clip.
 *
 * @public
 *
 * This is a pure data value, so gameplay code can keep it in its own state
 * service and advance it each tick without depending on a runtime singleton.
 */
export interface AnimationPlaybackState<Frame = number> {
	readonly clip: AnimationClip<Frame>;
	readonly direction: AnimationDirection;
	readonly elapsedSeconds: number;
	readonly frameIndex: number;
	readonly isPlaying: boolean;
	readonly mode: AnimationPlaybackMode;
	readonly speed: number;
}

/**
 * Result of switching from one clip to another.
 *
 * @public
 *
 * `preservePlayback` keeps direction, mode, speed, and elapsed playback when a
 * state machine wants the next clip to inherit momentum from the previous one.
 */
export interface AnimationTransition<Frame = number> {
	readonly nextClipId: string;
	readonly preservePlayback?: boolean;
	readonly state: AnimationPlaybackState<Frame>;
}

/** Indicates that animation lookup referenced a clip id the library does not contain. @public */
export class AnimationClipNotFoundError extends Schema.TaggedErrorClass<AnimationClipNotFoundError>()(
	"AnimationClipNotFoundError",
	{
		clipId: Schema.String,
	},
) {}

/** Runtime state for a scalar tween created with {@link startScalarTween}. @public */
export interface ScalarTweenState {
	readonly durationSeconds: number;
	readonly elapsedSeconds: number;
	readonly easing: TweenEasing;
	readonly from: number;
	readonly isComplete: boolean;
	readonly to: number;
}

/** Minimal 2D vector used by the tween helpers in this module. @public */
export interface Vec2 {
	readonly x: number;
	readonly y: number;
}

/** Runtime state for a 2D tween created with {@link startVec2Tween}. @public */
export interface Vec2TweenState {
	readonly durationSeconds: number;
	readonly elapsedSeconds: number;
	readonly easing: TweenEasing;
	readonly from: Vec2;
	readonly isComplete: boolean;
	readonly to: Vec2;
}

/** Supported tween easing names. `linear` is constant speed. `ease-in-out-quad` eases both ends. @public */
export type TweenEasing = "ease-in-out-quad" | "linear";

function clampValue(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

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

function getPlaybackRate(direction: AnimationDirection, speed: number): number {
	return (direction === "forward" ? 1 : -1) * Math.max(speed, 0);
}

function getEasedValue(easing: TweenEasing, t: number): number {
	switch (easing) {
		case "ease-in-out-quad":
			return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
		case "linear":
			return t;
	}
}

/**
 * Identity helper that preserves clip inference at the call site.
 *
 * @public
 */
export function defineAnimationClip<Frame>(
	clip: AnimationClip<Frame>,
): AnimationClip<Frame> {
	return clip;
}

/**
 * Creates initial playback state for a clip.
 *
 * @public
 *
 * ```ts
 * const state = startAnimation(walk, { mode: "loop", speed: 1 });
 * ```
 */
export function startAnimation<Frame>(
	clip: AnimationClip<Frame>,
	options?: {
		readonly direction?: AnimationDirection;
		readonly mode?: AnimationPlaybackMode;
		readonly speed?: number;
	},
): AnimationPlaybackState<Frame> {
	return {
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
	};
}

/** Reads the frame payload currently selected by the playback state. @public */
export function getCurrentAnimationFrame<Frame>(
	state: AnimationPlaybackState<Frame>,
): Frame {
	return state.clip.frames[state.frameIndex] as Frame;
}

/** Returns a copy of the state with playback halted at the current frame. @public */
export function pauseAnimation<Frame>(
	state: AnimationPlaybackState<Frame>,
): AnimationPlaybackState<Frame> {
	return {
		...state,
		isPlaying: false,
	};
}

/** Returns a copy of the state with playback resumed. @public */
export function resumeAnimation<Frame>(
	state: AnimationPlaybackState<Frame>,
): AnimationPlaybackState<Frame> {
	return {
		...state,
		isPlaying: true,
	};
}

/** Switches only the playback direction without resetting elapsed time. @public */
export function setAnimationDirection<Frame>(
	state: AnimationPlaybackState<Frame>,
	direction: AnimationDirection,
): AnimationPlaybackState<Frame> {
	return {
		...state,
		direction,
	};
}

/** Clamps the speed to zero or above and keeps the rest of the state intact. @public */
export function setAnimationSpeed<Frame>(
	state: AnimationPlaybackState<Frame>,
	speed: number,
): AnimationPlaybackState<Frame> {
	return {
		...state,
		speed: Math.max(speed, 0),
	};
}

/**
 * Advances playback by a fixed amount of simulated time.
 *
 * @public
 *
 * Most games call this once per update tick with the same `deltaSeconds` value
 * they use for their gameplay simulation.
 */
export function advanceAnimation<Frame>(
	state: AnimationPlaybackState<Frame>,
	deltaSeconds: number,
): AnimationPlaybackState<Frame> {
	if (!state.isPlaying || state.clip.frames.length <= 1 || deltaSeconds <= 0) {
		return state;
	}

	const frameDurationSeconds = 1 / state.clip.framesPerSecond;
	const totalFramesAdvanced =
		(state.elapsedSeconds +
			deltaSeconds * getPlaybackRate(state.direction, state.speed)) /
		frameDurationSeconds;
	const nextFrameIndex = Math.trunc(totalFramesAdvanced);
	const tentativeFrameIndex =
		(state.direction === "forward" ? 0 : state.clip.frames.length - 1) +
		nextFrameIndex;

	if (state.mode === "once") {
		const clampedFrameIndex = clampValue(
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
				deltaSeconds * getPlaybackRate(state.direction, state.speed),
			frameIndex: clampedFrameIndex,
			isPlaying: isComplete ? false : state.isPlaying,
		};
	}

	return {
		...state,
		elapsedSeconds:
			state.elapsedSeconds +
			deltaSeconds * getPlaybackRate(state.direction, state.speed),
		frameIndex: normalizePlaybackIndex(
			state.clip.frames.length,
			tentativeFrameIndex,
		),
	};
}

/**
 * Builds the next clip state when an animation state machine changes clips.
 *
 * @public
 */
export function transitionAnimation<Frame>(
	currentState: AnimationPlaybackState<Frame>,
	nextClip: AnimationClip<Frame>,
	options?: {
		readonly preservePlayback?: boolean;
	},
): AnimationTransition<Frame> {
	return {
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
	};
}

/**
 * Creates a tween that moves from one scalar value to another over time.
 *
 * @public
 */
export function startScalarTween(
	from: number,
	to: number,
	durationSeconds: number,
	easing: TweenEasing = "linear",
): ScalarTweenState {
	return {
		durationSeconds: Math.max(durationSeconds, 0),
		elapsedSeconds: 0,
		easing,
		from,
		isComplete: durationSeconds <= 0,
		to,
	};
}

/** Evaluates the current scalar tween value. @public */
export function getScalarTweenValue(state: ScalarTweenState): number {
	if (state.durationSeconds <= 0) {
		return state.to;
	}

	const progress = clampValue(
		state.elapsedSeconds / state.durationSeconds,
		0,
		1,
	);
	return (
		state.from + (state.to - state.from) * getEasedValue(state.easing, progress)
	);
}

/** Advances a scalar tween by `deltaSeconds`. @public */
export function advanceScalarTween(
	state: ScalarTweenState,
	deltaSeconds: number,
): ScalarTweenState {
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
}

/**
 * Creates a tween between two 2D points.
 *
 * @public
 */
export function startVec2Tween(
	from: Vec2,
	to: Vec2,
	durationSeconds: number,
	easing: TweenEasing = "linear",
): Vec2TweenState {
	return {
		durationSeconds: Math.max(durationSeconds, 0),
		elapsedSeconds: 0,
		easing,
		from,
		isComplete: durationSeconds <= 0,
		to,
	};
}

/** Evaluates the current 2D tween value. @public */
export function getVec2TweenValue(state: Vec2TweenState): Vec2 {
	if (state.durationSeconds <= 0) {
		return state.to;
	}

	const progress = clampValue(
		state.elapsedSeconds / state.durationSeconds,
		0,
		1,
	);
	const easedProgress = getEasedValue(state.easing, progress);

	return {
		x: state.from.x + (state.to.x - state.from.x) * easedProgress,
		y: state.from.y + (state.to.y - state.from.y) * easedProgress,
	};
}

/** Advances a 2D tween by `deltaSeconds`. @public */
export function advanceVec2Tween(
	state: Vec2TweenState,
	deltaSeconds: number,
): Vec2TweenState {
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
}

export function createFadeTween(
	fromOpacity: number,
	toOpacity: number,
	durationSeconds: number,
): ScalarTweenState {
	return startScalarTween(fromOpacity, toOpacity, durationSeconds, "linear");
}

export function createFlashTween(
	peakIntensity: number,
	durationSeconds: number,
): ScalarTweenState {
	return startScalarTween(
		peakIntensity,
		0,
		durationSeconds,
		"ease-in-out-quad",
	);
}

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
>()("Effect2d/animation/Animation/AnimationLibrary") {
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
