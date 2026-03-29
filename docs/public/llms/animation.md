# Animation

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Animation API.

## Animation

### AnimationClip

- Kind: interface
- Source: `src/animation/Animation.ts:3`

Author-time description of a named clip.



`Frame` is intentionally generic so the same helper can drive sprite-sheet
frame indices, texture ids, or richer authored frame payloads.

```ts
const walk = defineAnimationClip({
 id: "walk",
 frames: [0, 1, 2, 3],
 framesPerSecond: 12,
});
```

### AnimationPlaybackMode

- Kind: type
- Source: `src/animation/Animation.ts:25`

Playback behavior for the ends of a clip. `loop` wraps, `once` stops.

### AnimationDirection

- Kind: type
- Source: `src/animation/Animation.ts:28`

Direction the clip advances through its `frames` array.

### AnimationPlaybackState

- Kind: interface
- Source: `src/animation/Animation.ts:31`

Runtime state for a playing clip.



This is a pure data value, so gameplay code can keep it in its own state
service and advance it each tick without depending on a runtime singleton.

### AnimationTransition

- Kind: interface
- Source: `src/animation/Animation.ts:49`

Result of switching from one clip to another.



`preservePlayback` keeps direction, mode, speed, and elapsed playback when a
state machine wants the next clip to inherit momentum from the previous one.

### AnimationClipNotFoundError

- Kind: error
- Source: `src/animation/Animation.ts:63`

Indicates that animation lookup referenced a clip id the library does not contain.

### ScalarTweenState

- Kind: interface
- Source: `src/animation/Animation.ts:71`

Runtime state for a scalar tween created with [startScalarTween](./llms/animation.md#animation-startscalartween).

### Vec2

- Kind: interface
- Source: `src/animation/Animation.ts:81`

Minimal 2D vector used by the tween helpers in this module.

### Vec2TweenState

- Kind: interface
- Source: `src/animation/Animation.ts:87`

Runtime state for a 2D tween created with [startVec2Tween](./llms/animation.md#animation-startvec2tween).

### TweenEasing

- Kind: type
- Source: `src/animation/Animation.ts:97`

Supported tween easing names. `linear` is constant speed. `ease-in-out-quad` eases both ends.

### defineAnimationClip

- Kind: function
- Source: `src/animation/Animation.ts:129`

Identity helper that preserves clip inference at the call site.

### startAnimation

- Kind: function
- Source: `src/animation/Animation.ts:140`

Creates initial playback state for a clip.



```ts
const state = startAnimation(walk, { mode: "loop", speed: 1 });
```

### getCurrentAnimationFrame

- Kind: function
- Source: `src/animation/Animation.ts:171`

Reads the frame payload currently selected by the playback state.

### pauseAnimation

- Kind: function
- Source: `src/animation/Animation.ts:178`

Returns a copy of the state with playback halted at the current frame.

### resumeAnimation

- Kind: function
- Source: `src/animation/Animation.ts:188`

Returns a copy of the state with playback resumed.

### setAnimationDirection

- Kind: function
- Source: `src/animation/Animation.ts:198`

Switches only the playback direction without resetting elapsed time.

### setAnimationSpeed

- Kind: function
- Source: `src/animation/Animation.ts:209`

Clamps the speed to zero or above and keeps the rest of the state intact.

### advanceAnimation

- Kind: function
- Source: `src/animation/Animation.ts:220`

Advances playback by a fixed amount of simulated time.



Most games call this once per update tick with the same `deltaSeconds` value
they use for their gameplay simulation.

### transitionAnimation

- Kind: function
- Source: `src/animation/Animation.ts:279`

Builds the next clip state when an animation state machine changes clips.

### startScalarTween

- Kind: function
- Source: `src/animation/Animation.ts:312`

Creates a tween that moves from one scalar value to another over time.

### getScalarTweenValue

- Kind: function
- Source: `src/animation/Animation.ts:333`

Evaluates the current scalar tween value.

### advanceScalarTween

- Kind: function
- Source: `src/animation/Animation.ts:349`

Advances a scalar tween by `deltaSeconds`.

### startVec2Tween

- Kind: function
- Source: `src/animation/Animation.ts:370`

Creates a tween between two 2D points.

### getVec2TweenValue

- Kind: function
- Source: `src/animation/Animation.ts:391`

Evaluates the current 2D tween value.

### advanceVec2Tween

- Kind: function
- Source: `src/animation/Animation.ts:410`

Advances a 2D tween by `deltaSeconds`.