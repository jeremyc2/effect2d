# Sequence

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Sequence API.

## Sequence

### InvalidSequenceWaitError

- Kind: error
- Source: `src/sequence/Sequence.ts:43`

Indicates that a sequence wait step count was invalid.

### SequenceEvent

- Kind: type
- Source: `src/sequence/Sequence.ts:51`

A small union of conventional authored events that cutscenes or gameplay
scripts may publish.



Available event kinds:
- `player-damaged`
- `enemy-defeated`
- `pickup-collected`
- `scene-changed`
- `save-completed`

### SequenceEvents

- Kind: service
- Source: `src/sequence/Sequence.ts:95`

A lightweight published-event journal for authored sequences. This is handy when a game wants cutscene-like code to publish notable milestones without coupling directly to every downstream system.

#### Methods

- `clear: Effect.Effect<void>`
- `drain: Effect.Effect<ReadonlyArray<SequenceEvent>>`
- `publish: (event: SequenceEvent) => Effect.Effect<void>`
- `snapshot: Effect.Effect<ReadonlyArray<SequenceEvent>>`

### Sequence

- Kind: service
- Source: `src/sequence/Sequence.ts:144`

A convenience orchestration service for authored gameplay beats over time.



`Sequence` is the low-level timing and side-effect toolbox. When a script
needs to wait fixed steps, switch scenes, play cues, or fork a timed effect,
this is usually the service you compose with.

#### Methods

- `fade: ( opacity: number, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `flash: ( intensity: number, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `fork: <Success, Failure, Requirements>( effect: Effect.Effect<Success, Failure, Requirements>, ) => Effect.Effect< Fiber.Fiber<Success, Failure>, never, Requirements | Scope.Scope >`
- `playMusicCue: ( cueId: string, ) => Effect.Effect<void, UnknownAudioCueError | WrongAudioCueKindError>`
- `playSoundCue: ( cueId: string, ) => Effect.Effect<string, UnknownAudioCueError | WrongAudioCueKindError>`
- `popOverlayScene: Effect.Effect< void, OverlayStackUnderflowError | SceneStackEmptyError >`
- `pushOverlayScene: ( sceneId: SceneId, ) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>`
- `run: ( effects: ReadonlyArray<Effect.Effect<void>>, ) => Effect.Effect<void>`
- `switchScene: ( sceneId: SceneId, ) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>`
- `waitSteps: ( steps: number, ) => Effect.Effect<void, InvalidSequenceWaitError>`