# Audio

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Audio API.

## Audio

### AudioBus

- Kind: type
- Source: `src/audio/Audio.ts:4`

Logical buses supported by the mixer.

### AudioCueKind

- Kind: type
- Source: `src/audio/Audio.ts:7`

The cue categories understood by the engine.


The engine understands two cue kinds: "music" and "sfx".
- "music" cues are intended to play continuously and loop until stopped.
- "sfx" cues are intended to play once and then stop.

### AudioCueDefinition

- Kind: interface
- Source: `src/audio/Audio.ts:16`

Declares a reusable authored audio cue.

### LoadedAudioCue

- Kind: interface
- Source: `src/audio/Audio.ts:25`

A loaded cue paired with its resolved kind.

### AudioPlaybackOptions

- Kind: interface
- Source: `src/audio/Audio.ts:30`

Optional playback overrides for an individual cue trigger.

### MusicPlayback

- Kind: interface
- Source: `src/audio/Audio.ts:37`

The current music channel state.

### SoundPlayback

- Kind: interface
- Source: `src/audio/Audio.ts:46`

A single overlapping sound-effect playback instance.

### AudioSnapshot

- Kind: interface
- Source: `src/audio/Audio.ts:51`

A complete snapshot of authored mixer state.

### DuplicateAudioCueError

- Kind: error
- Source: `src/audio/Audio.ts:105`

Indicates that a cue id was registered more than once.

### InvalidAudioCueError

- Kind: error
- Source: `src/audio/Audio.ts:113`

Indicates that an authored cue definition failed validation.

### InvalidAudioBusVolumeError

- Kind: error
- Source: `src/audio/Audio.ts:122`

Indicates that a bus volume fell outside the inclusive 0..1 range.

### UnknownAudioCueError

- Kind: error
- Source: `src/audio/Audio.ts:131`

Indicates that playback referenced a cue id that has not been loaded.

### UnknownSoundPlaybackError

- Kind: error
- Source: `src/audio/Audio.ts:139`

Indicates that code referenced a sound playback handle that no longer exists.

### WrongAudioCueKindError

- Kind: error
- Source: `src/audio/Audio.ts:147`

Indicates that a cue was used as music vs sfx in the wrong context.

### Audio

- Kind: service
- Source: `src/audio/Audio.ts:203`

The engine's cue-driven audio service.



Game code usually loads stable cue ids during startup and refers to those ids
during play, instead of scattering file paths throughout gameplay logic. This
keeps audio orchestration testable, deterministic, and portable across native
backends.

#### Methods

- `completeSound: (playbackId: string) => Effect.Effect<void>`
- `loadMusic: ( definition: AudioCueDefinition, ) => Effect.Effect<void, DuplicateAudioCueError | InvalidAudioCueError>`
- `loadSound: ( definition: AudioCueDefinition, ) => Effect.Effect<void, DuplicateAudioCueError | InvalidAudioCueError>`
- `loadedCues: Effect.Effect<ReadonlyArray<LoadedAudioCue>>`
- `music: Effect.Effect<MusicPlayback | null>`
- `pauseMusic: Effect.Effect<void>`
- `playMusic: ( cueId: string, options?: AudioPlaybackOptions, ) => Effect.Effect<void, UnknownAudioCueError | WrongAudioCueKindError>`
- `playSfx: ( cueId: string, options?: AudioPlaybackOptions, ) => Effect.Effect<string, UnknownAudioCueError | WrongAudioCueKindError>`
- `resumeMusic: Effect.Effect<void>`
- `setBusVolume: ( bus: AudioBus, volume: number, ) => Effect.Effect<void, InvalidAudioBusVolumeError>`
- `snapshot: Effect.Effect<AudioSnapshot>`
- `sounds: Effect.Effect<ReadonlyArray<SoundPlayback>>`
- `stopAll: Effect.Effect<void>`
- `stopMusic: Effect.Effect<void>`
- `stopSound: ( playbackId: string, ) => Effect.Effect<void, UnknownSoundPlaybackError>`