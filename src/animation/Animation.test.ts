import { describe, expect, test } from "bun:test";
import {
	advanceAnimation,
	advanceScalarTween,
	advanceVec2Tween,
	createFadeTween,
	createFlashTween,
	defineAnimationClip,
	getCurrentAnimationFrame,
	getScalarTweenValue,
	getVec2TweenValue,
	pauseAnimation,
	resumeAnimation,
	setAnimationDirection,
	setAnimationSpeed,
	startAnimation,
	startScalarTween,
	startVec2Tween,
	transitionAnimation,
} from "./Animation.ts";

describe("Animation", () => {
	test("steps frame-based animation clips deterministically", () => {
		const idle = defineAnimationClip({
			frames: ["idle-0", "idle-1", "idle-2"],
			framesPerSecond: 10,
			id: "idle",
		});

		const advanced = advanceAnimation(startAnimation(idle), 0.25);

		expect(advanced.frameIndex).toBe(2);
		expect(getCurrentAnimationFrame(advanced)).toBe("idle-2");
	});

	test("supports pausing, resuming, speed changes, and reverse playback", () => {
		const walk = defineAnimationClip({
			frames: [0, 1, 2, 3],
			framesPerSecond: 4,
			id: "walk",
		});

		const paused = pauseAnimation(startAnimation(walk));
		expect(advanceAnimation(paused, 1).frameIndex).toBe(0);

		const resumed = resumeAnimation(paused);
		const reversed = setAnimationDirection(
			setAnimationSpeed(resumed, 2),
			"reverse",
		);
		const advanced = advanceAnimation(reversed, 0.5);

		expect(advanced.direction).toBe("reverse");
		expect(advanced.speed).toBe(2);
		expect(advanced.frameIndex).toBe(3);
	});

	test("stops once-mode playback at the terminal frame", () => {
		const attack = defineAnimationClip({
			frames: ["a", "b", "c"],
			framesPerSecond: 8,
			id: "attack",
		});

		const advanced = advanceAnimation(
			startAnimation(attack, { mode: "once" }),
			1,
		);

		expect(advanced.frameIndex).toBe(2);
		expect(advanced.isPlaying).toBe(false);
	});

	test("transitions between clips without inventing a state machine framework", () => {
		const idle = defineAnimationClip({
			frames: [0, 1],
			framesPerSecond: 2,
			id: "idle",
		});
		const walk = defineAnimationClip({
			frames: [10, 11, 12],
			framesPerSecond: 6,
			id: "walk",
		});

		const transition = transitionAnimation(
			setAnimationDirection(startAnimation(idle), "reverse"),
			walk,
			{ preservePlayback: true },
		);

		expect(transition.nextClipId).toBe("walk");
		expect(transition.state.clip.id).toBe("walk");
		expect(transition.state.direction).toBe("reverse");
	});
});

describe("Tween", () => {
	test("advances scalar tweens with easing", () => {
		const halfway = advanceScalarTween(
			startScalarTween(0, 10, 2, "ease-in-out-quad"),
			1,
		);

		expect(getScalarTweenValue(halfway)).toBe(5);
		expect(halfway.isComplete).toBe(false);

		const completed = advanceScalarTween(halfway, 1);
		expect(getScalarTweenValue(completed)).toBe(10);
		expect(completed.isComplete).toBe(true);
	});

	test("advances vec2 tweens for camera and actor motion helpers", () => {
		const tween = advanceVec2Tween(
			startVec2Tween({ x: 0, y: 0 }, { x: 20, y: 10 }, 2),
			0.5,
		);

		expect(getVec2TweenValue(tween)).toEqual({
			x: 5,
			y: 2.5,
		});
	});

	test("provides fade and flash utility tweens", () => {
		const fade = advanceScalarTween(createFadeTween(0, 1, 1), 0.5);
		const flash = advanceScalarTween(createFlashTween(1, 1), 0.5);

		expect(getScalarTweenValue(fade)).toBe(0.5);
		expect(getScalarTweenValue(flash)).toBe(0.5);
	});
});
