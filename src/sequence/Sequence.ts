import {
	Context,
	Effect,
	type Fiber,
	Layer,
	Ref,
	Schema,
	type Scope,
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

/** Indicates that a sequence wait step count was invalid. @public */
export class InvalidSequenceWaitError extends Schema.TaggedErrorClass<InvalidSequenceWaitError>()(
	"InvalidSequenceWaitError",
	{
		steps: Schema.Number,
	},
) {}

/**
 * A small union of conventional authored events that cutscenes or gameplay
 * scripts may publish.
 *
 * @public
 *
 * Available event kinds:
 * - `player-damaged`
 * - `enemy-defeated`
 * - `pickup-collected`
 * - `scene-changed`
 * - `save-completed`
 */
export type SequenceEvent =
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

interface SequenceEventJournalState {
	readonly events: ReadonlyArray<SequenceEvent>;
}

const initialSequenceEventJournalState: SequenceEventJournalState = {
	events: [],
};

/** A lightweight published-event journal for authored sequences. This is handy when a game wants cutscene-like code to publish notable milestones without coupling directly to every downstream system. @public */
export class SequenceEvents extends Context.Service<
	SequenceEvents,
	{
		readonly clear: Effect.Effect<void>;
		readonly drain: Effect.Effect<ReadonlyArray<SequenceEvent>>;
		readonly publish: (event: SequenceEvent) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<ReadonlyArray<SequenceEvent>>;
	}
>()("effect2d/sequence/Sequence/SequenceEvents") {
	static readonly layer = Layer.effect(
		SequenceEvents,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialSequenceEventJournalState);

			const publish = Effect.fn("SequenceEvents.publish")(function* (
				event: SequenceEvent,
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

			return SequenceEvents.of({
				clear,
				drain,
				publish,
				snapshot,
			});
		}),
	);
}

/**
 * A convenience orchestration service for authored gameplay beats over time.
 *
 * @public
 *
 * `Sequence` is the low-level timing and side-effect toolbox. When a script
 * needs to wait fixed steps, switch scenes, play cues, or fork a timed effect,
 * this is usually the service you compose with.
 */
export class Sequence extends Context.Service<
	Sequence,
	{
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
		readonly popOverlayScene: Effect.Effect<
			void,
			OverlayStackUnderflowError | SceneStackEmptyError
		>;
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
>()("effect2d/sequence/Sequence") {
	static readonly layer = Layer.effect(
		Sequence,
		Effect.gen(function* () {
			const audio = yield* Audio;
			const graphics = yield* Graphics;
			const runtimeClock = yield* RuntimeClock;
			const sceneDirector = yield* SceneDirector;

			const waitSteps = Effect.fn("Sequence.waitSteps")(function* (
				steps: number,
			) {
				if (!Number.isInteger(steps) || steps < 0) {
					return yield* new InvalidSequenceWaitError({
						steps,
					});
				}

				for (let index = 0; index < steps; index += 1) {
					yield* runtimeClock.sleepFixedStep;
				}
			});

			const run = Effect.fn("Sequence.run")(function* (
				effects: ReadonlyArray<Effect.Effect<void>>,
			) {
				yield* Effect.forEach(effects, (effect) => effect, {
					discard: true,
				});
			});

			const playMusicCue = Effect.fn("Sequence.playMusicCue")(function* (
				cueId: string,
			) {
				yield* audio.playMusic(cueId, { loop: true });
			});

			const playSoundCue = Effect.fn("Sequence.playSoundCue")(function* (
				cueId: string,
			) {
				return yield* audio.playSfx(cueId);
			});

			const fade = Effect.fn("Sequence.fade")(function* (
				opacity: number,
				color: Color = defaultFadeColor,
			) {
				yield* graphics.drawFade(opacity, color);
			});

			const flash = Effect.fn("Sequence.flash")(function* (
				intensity: number,
				color: Color = defaultFlashColor,
			) {
				yield* graphics.drawFlash(intensity, color);
			});

			const switchScene = Effect.fn("Sequence.switchScene")(function* (
				sceneId: SceneId,
			) {
				yield* sceneDirector.switchTo(sceneId);
			});

			const pushOverlayScene = Effect.fn("Sequence.pushOverlayScene")(
				function* (sceneId: SceneId) {
					yield* sceneDirector.pushOverlay(sceneId);
				},
			);

			const popOverlayScene = Effect.withSpan("Sequence.popOverlayScene")(
				sceneDirector.popOverlay,
			);

			const fork = Effect.fn("Sequence.fork")(function* <
				Success,
				Failure,
				Requirements,
			>(effect: Effect.Effect<Success, Failure, Requirements>) {
				return yield* effect.pipe(
					Effect.forkScoped({ startImmediately: true }),
				);
			});

			return Sequence.of({
				fade,
				flash,
				fork,
				playMusicCue,
				playSoundCue,
				popOverlayScene,
				pushOverlayScene,
				run,
				switchScene,
				waitSteps,
			});
		}),
	);
}
