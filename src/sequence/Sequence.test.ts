import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";
import { Audio } from "../audio/Audio.ts";
import { Graphics } from "../graphics/Graphics.ts";
import { RuntimeClock } from "../runtime/RuntimeClock.ts";
import type { SceneDefinition, SceneId } from "../scene/Scene.ts";
import { SceneDirector } from "../scene/SceneDirector.ts";
import { SceneRegistry } from "../scene/SceneRegistry.ts";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { Sequence, SequenceEvents } from "./Sequence.ts";

const makeScene = (id: SceneId): SceneDefinition => ({
	id,
	instantiate: Effect.succeed({
		enter: () => Effect.void,
		exit: () => Effect.void,
		draw: () => Effect.void,
		handleInput: () => Effect.void,
		update: () => Effect.void,
	}),
});

const makeSequenceLayer = () => {
	const sceneRegistryLayer = SceneRegistry.layer([
		makeScene("overworld"),
		makeScene("pause"),
	]);
	const sceneDirectorLayer = SceneDirector.layer("overworld").pipe(
		Layer.provide(sceneRegistryLayer),
	);
	const dependencies = Layer.mergeAll(
		Audio.layer,
		Graphics.layer,
		RuntimeClock.layer(60),
		TestClock.layer(),
		sceneDirectorLayer,
	);

	return Layer.mergeAll(
		dependencies,
		SequenceEvents.layer,
		Sequence.layer.pipe(Layer.provide(dependencies)),
	);
};

describe("Sequence", () => {
	test("orchestrates timing, audio, fades, and scene flow", async () => {
		await runLayerEffect(
			makeSequenceLayer(),
			Effect.gen(function* () {
				const audio = yield* Audio;
				const graphics = yield* Graphics;
				const runtimeClock = yield* RuntimeClock;
				const sceneDirector = yield* SceneDirector;
				const sequence = yield* Sequence;

				yield* audio.loadMusic({
					cueId: "overworld-theme",
					defaultLoop: true,
					defaultPitch: 1,
					defaultVolume: 0.8,
					sourcePath: "audio/music/overworld.ogg",
				});
				yield* audio.loadSound({
					cueId: "confirm",
					defaultLoop: false,
					defaultPitch: 1,
					defaultVolume: 0.7,
					sourcePath: "audio/sfx/confirm.wav",
				});

				const waitFiber = yield* sequence.waitSteps(2).pipe(Effect.forkChild);
				yield* TestClock.adjust(34);
				yield* Fiber.await(waitFiber);

				yield* graphics.beginFrame;
				yield* sequence.fade(0.5);
				yield* sequence.flash(0.25);
				yield* sequence.playMusicCue("overworld-theme");
				const playbackId = yield* sequence.playSoundCue("confirm");
				yield* sequence.switchScene("pause");
				const frame = yield* graphics.endFrame;

				expect(frame.commands.map((command) => command.type)).toContain(
					"draw-fade",
				);
				expect(frame.commands.map((command) => command.type)).toContain(
					"draw-flash",
				);
				expect((yield* audio.music)?.cueId).toBe("overworld-theme");
				expect(
					(yield* audio.sounds).some(
						(sound) => sound.playbackId === playbackId,
					),
				).toBe(true);
				expect((yield* runtimeClock.snapshot()).fixedTickMillis).toBe(
					1_000 / 60,
				);
				expect((yield* sceneDirector.snapshot).activeSceneId).toBe("pause");
			}),
		);
	});

	test("forks scoped sequences that are canceled when the scope closes", async () => {
		await runLayerEffect(
			makeSequenceLayer(),
			Effect.gen(function* () {
				const sequence = yield* Sequence;
				const finishedRef = yield* Ref.make(false);

				yield* Effect.scoped(
					sequence
						.fork(
							Effect.forever(Effect.sleep("1 second")).pipe(
								Effect.ensuring(Ref.set(finishedRef, true)),
							),
						)
						.pipe(Effect.asVoid),
				);

				expect(yield* Ref.get(finishedRef)).toBe(true);
			}),
		);
	});

	test("captures and drains selective typed domain events", async () => {
		await runLayerEffect(
			makeSequenceLayer(),
			Effect.gen(function* () {
				const events = yield* SequenceEvents;

				yield* events.publish({
					entityId: "player",
					amount: 1,
					type: "player-damaged",
				});
				yield* events.publish({
					sceneId: "pause",
					type: "scene-changed",
				});

				expect(yield* events.snapshot).toHaveLength(2);
				expect(yield* events.drain).toEqual([
					{
						amount: 1,
						entityId: "player",
						type: "player-damaged",
					},
					{
						sceneId: "pause",
						type: "scene-changed",
					},
				]);
				expect(yield* events.snapshot).toEqual([]);
			}),
		);
	});
});
