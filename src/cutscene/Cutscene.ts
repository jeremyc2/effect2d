import { Effect, Layer, Schema, ServiceMap } from "effect";
import type {
	UnknownAudioCueError,
	WrongAudioCueKindError,
} from "../audio/Audio.ts";
import type { Color, GraphicsFrameNotOpenError } from "../graphics/Graphics.ts";
import type { SceneId } from "../scene/Scene.ts";
import type {
	OverlayStackUnderflowError,
	SceneNotFoundError,
	SceneStackEmptyError,
} from "../scene/SceneError.ts";
import {
	type InvalidSequenceWaitError,
	Sequence,
} from "../sequence/Sequence.ts";
import { type DialoguePage, UI, type UnknownFontError } from "../ui/UI.ts";

/** The current state of a prepared cutscene dialogue sequence. @public */
export interface DialogueProgress {
	readonly hasNextPage: boolean;
	readonly isComplete: boolean;
	readonly page: DialoguePage;
	readonly pageIndex: number;
}

/** Options for paginating authored dialogue text into pages that fit a dialogue box. @public */
export interface DialogueScriptOptions {
	readonly fontId: string;
	readonly maxLines: number;
	readonly maxWidth: number;
	readonly text: string;
}

export class DialoguePageOutOfRangeError extends Schema.TaggedErrorClass<DialoguePageOutOfRangeError>()(
	"DialoguePageOutOfRangeError",
	{
		pageCount: Schema.Number,
		pageIndex: Schema.Number,
	},
) {}

const nthDialoguePage = Effect.fn("Cutscene.nthDialoguePage")(function* (
	pages: ReadonlyArray<DialoguePage>,
	pageIndex: number,
) {
	const page = pages[pageIndex];
	if (page === undefined) {
		return yield* new DialoguePageOutOfRangeError({
			pageCount: pages.length,
			pageIndex,
		});
	}

	return page;
});

/**
 * A higher-level cinematic helper built on top of {@link Sequence} and
 * {@link UI}.
 *
 * @public
 *
 * Reach for `Cutscene` when you want a friendlier API around dialogue prep and
 * scene-sequence operations, but still want to stay inside ordinary Effect
 * programs.
 */
export class Cutscene extends ServiceMap.Service<
	Cutscene,
	{
		readonly advanceDialogue: (
			pages: ReadonlyArray<DialoguePage>,
			pageIndex: number,
		) => Effect.Effect<DialogueProgress, DialoguePageOutOfRangeError>;
		readonly fade: (
			opacity: number,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly flash: (
			intensity: number,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly play: <Success, Failure, Requirements>(
			effect: Effect.Effect<Success, Failure, Requirements>,
		) => Effect.Effect<Success, Failure, Requirements>;
		readonly playMusicCue: (
			cueId: string,
		) => Effect.Effect<void, UnknownAudioCueError | WrongAudioCueKindError>;
		readonly playSoundCue: (
			cueId: string,
		) => Effect.Effect<string, UnknownAudioCueError | WrongAudioCueKindError>;
		readonly popOverlayScene: () => Effect.Effect<
			void,
			OverlayStackUnderflowError | SceneStackEmptyError
		>;
		readonly prepareDialogue: (
			options: DialogueScriptOptions,
		) => Effect.Effect<ReadonlyArray<DialoguePage>, UnknownFontError>;
		readonly pushOverlayScene: (
			sceneId: SceneId,
		) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>;
		readonly run: (
			effects: ReadonlyArray<Effect.Effect<void>>,
		) => Effect.Effect<void>;
		readonly switchScene: (
			sceneId: SceneId,
		) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>;
		readonly waitSteps: (
			steps: number,
		) => Effect.Effect<void, InvalidSequenceWaitError>;
	}
>()("effect2d/cutscene/Cutscene") {
	static readonly layer = Layer.effect(
		Cutscene,
		Effect.gen(function* () {
			const sequence = yield* Sequence;
			const ui = yield* UI;

			const prepareDialogue = Effect.fn("Cutscene.prepareDialogue")(function* (
				options: DialogueScriptOptions,
			) {
				return yield* ui.paginateDialogue({
					fontId: options.fontId,
					maxLines: options.maxLines,
					maxWidth: options.maxWidth,
					text: options.text,
				});
			});

			const advanceDialogue = Effect.fn("Cutscene.advanceDialogue")(function* (
				pages: ReadonlyArray<DialoguePage>,
				pageIndex: number,
			) {
				const page = yield* nthDialoguePage(pages, pageIndex);
				return {
					hasNextPage: page.hasNextPage,
					isComplete: !page.hasNextPage,
					page,
					pageIndex,
				} satisfies DialogueProgress;
			});

			const play = Effect.fn("Cutscene.play")(function* <
				Success,
				Failure,
				Requirements,
			>(effect: Effect.Effect<Success, Failure, Requirements>) {
				return yield* effect;
			});

			return Cutscene.of({
				advanceDialogue,
				fade: sequence.fade,
				flash: sequence.flash,
				play,
				playMusicCue: sequence.playMusicCue,
				playSoundCue: sequence.playSoundCue,
				popOverlayScene: sequence.popOverlayScene,
				prepareDialogue,
				pushOverlayScene: sequence.pushOverlayScene,
				run: sequence.run,
				switchScene: sequence.switchScene,
				waitSteps: sequence.waitSteps,
			});
		}),
	);
}
