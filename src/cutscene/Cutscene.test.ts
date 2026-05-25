import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { Audio } from "../audio/Audio.ts";
import { Graphics } from "../graphics/Graphics.ts";
import { Input } from "../input/Input.ts";
import { RuntimeClock } from "../runtime/RuntimeClock.ts";
import type { SceneDefinition, SceneId } from "../scene/Scene.ts";
import { SceneDirector } from "../scene/SceneDirector.ts";
import { SceneLookup } from "../scene/SceneLookup.ts";
import { Sequence } from "../sequence/Sequence.ts";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { UI } from "../ui/UI.ts";
import { Cutscene, DialoguePageOutOfRangeError } from "./Cutscene.ts";

const makeScene = (id: SceneId): SceneDefinition => ({
	id,
	instantiate: Effect.succeed({
		enter: Effect.void,
		exit: Effect.void,
		draw: Effect.void,
		handleInput: Effect.void,
		update: Effect.void,
	}),
});

const makeCutsceneLayer = () => {
	const sceneLookupLayer = SceneLookup.layer([
		makeScene("overworld"),
		makeScene("pause"),
	]);
	const sceneDirectorLayer = SceneDirector.layer({
		startSceneId: "overworld",
	}).pipe(Layer.provide(sceneLookupLayer));
	const uiDependencies = Layer.mergeAll(Graphics.layer, Input.layer);
	const dependencies = Layer.mergeAll(
		Audio.layer,
		Graphics.layer,
		Input.layer,
		RuntimeClock.layer(60),
		TestClock.layer(),
		sceneDirectorLayer,
	);
	const uiLayer = UI.layer.pipe(Layer.provide(uiDependencies));
	const sequenceLayer = Sequence.layer.pipe(Layer.provide(dependencies));

	return Layer.mergeAll(
		dependencies,
		uiLayer,
		sequenceLayer,
		Cutscene.layer.pipe(Layer.provide(Layer.mergeAll(sequenceLayer, uiLayer))),
	);
};

describe("Cutscene", () => {
	test("prepares and advances dialogue pages through the cinematic helper", () =>
		runLayerEffect(
			makeCutsceneLayer(),
			Effect.gen(function* () {
				const cutscene = yield* Cutscene;
				const ui = yield* UI;

				yield* ui.loadFont({
					fontId: "dialogue",
					glyphWidth: 8,
					lineHeight: 10,
					sourcePath: "fonts/dialogue.ttf",
				});

				const pages = yield* cutscene.prepareDialogue({
					fontId: "dialogue",
					maxLines: 2,
					maxWidth: 80,
					text: "Keep your lantern close. The cave swallows weak light.",
				});
				const firstPage = yield* cutscene.advanceDialogue(pages, 0);

				expect(firstPage.page.pageIndex).toBe(0);
				expect(firstPage.hasNextPage).toBe(true);
				expect(firstPage.isComplete).toBe(false);
			}),
		));

	test("fails when asked for a dialogue page that does not exist", () =>
		runLayerEffect(
			makeCutsceneLayer(),
			Effect.gen(function* () {
				const cutscene = yield* Cutscene;
				const ui = yield* UI;

				yield* ui.loadFont({
					fontId: "dialogue",
					glyphWidth: 8,
					lineHeight: 10,
					sourcePath: "fonts/dialogue.ttf",
				});

				const pages = yield* cutscene.prepareDialogue({
					fontId: "dialogue",
					maxLines: 2,
					maxWidth: 80,
					text: "Short page.",
				});

				const failure = yield* cutscene
					.advanceDialogue(pages, 2)
					.pipe(Effect.flip);

				expect(failure).toBeInstanceOf(DialoguePageOutOfRangeError);
				expect(failure.pageCount).toBe(1);
				expect(failure.pageIndex).toBe(2);
			}),
		));
});
