import {
	Effect,
	type Fiber,
	Layer,
	Ref,
	Schema,
	type Scope,
	ServiceMap,
} from "effect";
import {
	Audio,
	type UnknownAudioCueError,
	type WrongAudioCueKindError,
} from "../audio/Audio.ts";
import {
	type Color,
	Graphics,
	type GraphicsFrameNotOpenError,
} from "../graphics/Graphics.ts";
import { RuntimeClock } from "../runtime/RuntimeClock.ts";
import type { SceneId } from "../scene/Scene.ts";
import { SceneDirector } from "../scene/SceneDirector.ts";
import type {
	OverlayStackUnderflowError,
	SceneNotFoundError,
	SceneStackEmptyError,
} from "../scene/SceneError.ts";
import { type DialoguePage, Ui, type UnknownFontError } from "../ui/Ui.ts";

export interface DialogueProgress {
	readonly hasNextPage: boolean;
	readonly isComplete: boolean;
	readonly page: DialoguePage;
	readonly pageIndex: number;
}

export interface DialogueScriptOptions {
	readonly fontId: string;
	readonly maxLines: number;
	readonly maxWidth: number;
	readonly text: string;
}

const defaultFadeColor: Color = {
	alpha: 1,
	blue: 0,
	green: 0,
	red: 0,
};

const defaultFlashColor: Color = {
	alpha: 1,
	blue: 1,
	green: 1,
	red: 1,
};

export class InvalidScriptWaitError extends Schema.TaggedErrorClass<InvalidScriptWaitError>()(
	"InvalidScriptWaitError",
	{
		steps: Schema.Number,
	},
) {}

export class DialoguePageOutOfRangeError extends Schema.TaggedErrorClass<DialoguePageOutOfRangeError>()(
	"DialoguePageOutOfRangeError",
	{
		pageCount: Schema.Number,
		pageIndex: Schema.Number,
	},
) {}

export type ScriptEvent =
	| {
			readonly amount: number;
			readonly entityId: string;
			readonly type: "player-damaged";
	  }
	| {
			readonly enemyId: string;
			readonly type: "enemy-defeated";
	  }
	| {
			readonly pickupId: string;
			readonly type: "pickup-collected";
	  }
	| {
			readonly sceneId: string;
			readonly type: "scene-changed";
	  }
	| {
			readonly slotId: string;
			readonly type: "save-completed";
	  };

interface ScriptEventJournalState {
	readonly events: ReadonlyArray<ScriptEvent>;
}

const initialScriptEventJournalState: ScriptEventJournalState = {
	events: [],
};

export class ScriptEvents extends ServiceMap.Service<
	ScriptEvents,
	{
		readonly clear: Effect.Effect<void>;
		readonly drain: Effect.Effect<ReadonlyArray<ScriptEvent>>;
		readonly publish: (event: ScriptEvent) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<ReadonlyArray<ScriptEvent>>;
	}
>()("effect2d/script/Script/ScriptEvents") {
	static readonly layer = Layer.effect(
		ScriptEvents,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialScriptEventJournalState);

			const publish = Effect.fn("ScriptEvents.publish")(function* (
				event: ScriptEvent,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					events: [...state.events, event],
				}));
			});

			const clear = Ref.update(stateRef, (state) => ({
				...state,
				events: [],
			}));

			const snapshot = Ref.get(stateRef).pipe(
				Effect.map((state) => state.events),
			);

			const drain = Effect.gen(function* () {
				const events = yield* snapshot;
				yield* clear;
				return events;
			});

			return ScriptEvents.of({
				clear,
				drain,
				publish,
				snapshot,
			});
		}),
	);
}

const nthDialoguePage = Effect.fn("Script.nthDialoguePage")(function* (
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

export class Script extends ServiceMap.Service<
	Script,
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
		readonly fork: <Success, Failure, Requirements>(
			effect: Effect.Effect<Success, Failure, Requirements>,
		) => Effect.Effect<
			Fiber.Fiber<Success, Failure>,
			never,
			Requirements | Scope.Scope
		>;
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
		readonly runSequence: (
			effects: ReadonlyArray<Effect.Effect<void>>,
		) => Effect.Effect<void>;
		readonly switchScene: (
			sceneId: SceneId,
		) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>;
		readonly waitSteps: (
			steps: number,
		) => Effect.Effect<void, InvalidScriptWaitError>;
	}
>()("effect2d/script/Script") {
	static readonly layer = Layer.effect(
		Script,
		Effect.gen(function* () {
			const audio = yield* Audio;
			const graphics = yield* Graphics;
			const runtimeClock = yield* RuntimeClock;
			const sceneDirector = yield* SceneDirector;
			const ui = yield* Ui;

			const waitSteps = Effect.fn("Script.waitSteps")(function* (
				steps: number,
			) {
				if (!Number.isInteger(steps) || steps < 0) {
					return yield* new InvalidScriptWaitError({
						steps,
					});
				}

				for (let index = 0; index < steps; index += 1) {
					yield* runtimeClock.sleepFixedStep;
				}
			});

			const runSequence = Effect.fn("Script.runSequence")(function* (
				effects: ReadonlyArray<Effect.Effect<void>>,
			) {
				yield* Effect.forEach(effects, (effect) => effect, {
					discard: true,
				});
			});

			const playMusicCue = Effect.fn("Script.playMusicCue")(function* (
				cueId: string,
			) {
				yield* audio.playMusic(cueId, { loop: true });
			});

			const playSoundCue = Effect.fn("Script.playSoundCue")(function* (
				cueId: string,
			) {
				return yield* audio.playSfx(cueId);
			});

			const fade = Effect.fn("Script.fade")(function* (
				opacity: number,
				color: Color = defaultFadeColor,
			) {
				yield* graphics.drawFade(opacity, color);
			});

			const flash = Effect.fn("Script.flash")(function* (
				intensity: number,
				color: Color = defaultFlashColor,
			) {
				yield* graphics.drawFlash(intensity, color);
			});

			const prepareDialogue = Effect.fn("Script.prepareDialogue")(function* (
				options: DialogueScriptOptions,
			) {
				return yield* ui.paginateDialogue({
					fontId: options.fontId,
					maxLines: options.maxLines,
					maxWidth: options.maxWidth,
					text: options.text,
				});
			});

			const advanceDialogue = Effect.fn("Script.advanceDialogue")(function* (
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

			const switchScene = Effect.fn("Script.switchScene")(function* (
				sceneId: SceneId,
			) {
				yield* sceneDirector.switchTo(sceneId);
			});

			const pushOverlayScene = Effect.fn("Script.pushOverlayScene")(function* (
				sceneId: SceneId,
			) {
				yield* sceneDirector.pushOverlay(sceneId);
			});

			const popOverlayScene = Effect.fn("Script.popOverlayScene")(function* () {
				yield* sceneDirector.popOverlay();
			});

			const fork = Effect.fn("Script.fork")(function* <
				Success,
				Failure,
				Requirements,
			>(effect: Effect.Effect<Success, Failure, Requirements>) {
				return yield* effect.pipe(
					Effect.forkScoped({ startImmediately: true }),
				);
			});

			return Script.of({
				advanceDialogue,
				fade,
				flash,
				fork,
				playMusicCue,
				playSoundCue,
				popOverlayScene,
				prepareDialogue,
				pushOverlayScene,
				runSequence,
				switchScene,
				waitSteps,
			});
		}),
	);
}
