# Cutscene

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Cutscene API.

## Cutscene

### DialogueProgress

- Kind: interface
- Source: `src/cutscene/Cutscene.ts:19`

The current state of a prepared cutscene dialogue sequence.

### DialogueScriptOptions

- Kind: interface
- Source: `src/cutscene/Cutscene.ts:27`

Options for paginating authored dialogue text into pages that fit a dialogue box.

### DialoguePageOutOfRangeError

- Kind: error
- Source: `src/cutscene/Cutscene.ts:35`

Indicates that dialogue advancement requested a page index outside the prepared page list.

### Cutscene

- Kind: service
- Source: `src/cutscene/Cutscene.ts:59`

A higher-level cinematic helper built on top of [Sequence](./llms/sequence.md#sequence-sequence) and
[UI](./llms/ui.md#ui-ui).



Reach for `Cutscene` when you want a friendlier API around dialogue prep and
scene-sequence operations, but still want to stay inside ordinary Effect
programs.

#### Methods

- `advanceDialogue: ( pages: ReadonlyArray<DialoguePage>, pageIndex: number, ) => Effect.Effect<DialogueProgress, DialoguePageOutOfRangeError>`
- `fade: ( opacity: number, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `flash: ( intensity: number, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `play: <Success, Failure, Requirements>( effect: Effect.Effect<Success, Failure, Requirements>, ) => Effect.Effect<Success, Failure, Requirements>`
- `playMusicCue: ( cueId: string, ) => Effect.Effect<void, UnknownAudioCueError | WrongAudioCueKindError>`
- `playSoundCue: ( cueId: string, ) => Effect.Effect<string, UnknownAudioCueError | WrongAudioCueKindError>`
- `popOverlayScene: () => Effect.Effect< void, OverlayStackUnderflowError | SceneStackEmptyError >`
- `prepareDialogue: ( options: DialogueScriptOptions, ) => Effect.Effect<ReadonlyArray<DialoguePage>, UnknownFontError>`
- `pushOverlayScene: ( sceneId: SceneId, ) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>`
- `run: ( effects: ReadonlyArray<Effect.Effect<void>>, ) => Effect.Effect<void>`
- `switchScene: ( sceneId: SceneId, ) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>`
- `waitSteps: ( steps: number, ) => Effect.Effect<void, InvalidSequenceWaitError>`