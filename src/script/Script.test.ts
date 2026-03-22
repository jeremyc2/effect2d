import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";
import { Audio } from "../audio/Audio.ts";
import { Graphics } from "../graphics/Graphics.ts";
import { Input } from "../input/Input.ts";
import { RuntimeClock } from "../runtime/RuntimeClock.ts";
import type { SceneDefinition, SceneId } from "../scene/Scene.ts";
import { SceneDirector } from "../scene/SceneDirector.ts";
import { SceneRegistry } from "../scene/SceneRegistry.ts";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { Ui } from "../ui/Ui.ts";
import { Script, ScriptEvents } from "./Script.ts";

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

const makeScriptLayer = () => {
	const sceneRegistryLayer = SceneRegistry.layer([
		makeScene("overworld"),
		makeScene("pause"),
	]);
	const sceneDirectorLayer = SceneDirector.layer("overworld").pipe(
		Layer.provide(sceneRegistryLayer),
	);
	const uiDependencies = Layer.mergeAll(Graphics.layer, Input.layer);
	const dependencies = Layer.mergeAll(
		Audio.layer,
		Graphics.layer,
		Input.layer,
		RuntimeClock.layer(60),
		TestClock.layer(),
		Ui.layer.pipe(Layer.provide(uiDependencies)),
		sceneDirectorLayer,
	);

	return Layer.mergeAll(
		dependencies,
		ScriptEvents.layer,
		Script.layer.pipe(Layer.provide(dependencies)),
	);
};

describe("Script", () => {
	test("orchestrates timing, audio, fades, and dialogue preparation", async () => {
		await runLayerEffect(
			makeScriptLayer(),
			Effect.gen(function* () {
				const audio = yield* Audio;
				const graphics = yield* Graphics;
				const runtimeClock = yield* RuntimeClock;
				const script = yield* Script;
				const ui = yield* Ui;

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
				yield* ui.loadFont({
					fontId: "dialogue",
					glyphWidth: 8,
					lineHeight: 10,
					sourcePath: "fonts/dialogue.ttf",
				});

				const waitFiber = yield* script.waitSteps(2).pipe(Effect.forkChild);
				yield* TestClock.adjust(34);
				yield* Fiber.await(waitFiber);

				yield* graphics.beginFrame;
				const pages = yield* script.prepareDialogue({
					fontId: "dialogue",
					maxLines: 2,
					maxWidth: 80,
					text: "Keep your lantern close. The cave swallows weak light.",
				});
				const firstPage = yield* script.advanceDialogue(pages, 0);
				yield* script.fade(0.5);
				yield* script.flash(0.25);
				yield* script.playMusicCue("overworld-theme");
				const playbackId = yield* script.playSoundCue("confirm");
				const frame = yield* graphics.endFrame;

				expect(firstPage.page.pageIndex).toBe(0);
				expect(firstPage.hasNextPage).toBe(true);
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
			}),
		);
	});

	test("forks scoped scripts that are canceled when the scope closes", async () => {
		await runLayerEffect(
			makeScriptLayer(),
			Effect.gen(function* () {
				const script = yield* Script;
				const finishedRef = yield* Ref.make(false);

				yield* Effect.scoped(
					script
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
			makeScriptLayer(),
			Effect.gen(function* () {
				const events = yield* ScriptEvents;

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
