# Runtime

> Public Runtime API.

## Engine

### Engine

- Kind: service
- Source: `src/runtime/Engine.ts:9`

The smallest runnable engine surface.



`Engine` is the service most applications eventually launch, but it is not
usually the first thing authors wire by hand. In a typical game you compose
a runtime with [makeRuntimeLayer](./llms/runtime.md#runtime-makeruntimelayer), register your authored services, and
then call `engine.launch()` or use [engineProgram](./llms/runtime.md#runtime-engineprogram).

This service intentionally stays narrow:

- `config` exposes the validated engine configuration
- `launch()` delegates to the active [NativeBoundary](./llms/native.md#native-nativeboundary)

Everything else that feels "game-like" lives in sibling services such as
[Graphics](./llms/graphics.md#graphics-graphics), [Input](./llms/input.md#input-input), [Audio](./llms/audio.md#audio-audio), [SceneDirector](./llms/scene.md#scene-scenedirector), and
your own game-specific state services.

#### Methods

- `config: EngineConfig`
- `launch: () => Effect.Effect<void, EngineLaunchError>`

## EngineConfig

### EngineConfig

- Kind: interface
- Source: `src/runtime/EngineConfig.ts:1`

Describes the minimal engine-level settings required to boot a game.



In most projects you start from [defaultEngineConfig](./llms/runtime.md#runtime-defaultengineconfig) and override only
the fields that are specific to your game.

```ts
const engineConfig: EngineConfig = {...defaultEngineConfig,
 gameId: "beacon-run",
 startScene: "title",
};
```

### defaultEngineConfig

- Kind: const
- Source: `src/runtime/EngineConfig.ts:28`

A conservative starting configuration for new games.



This value is intentionally plain and production-safe. Treat it as a base
object to spread into a game-specific config rather than a one-size-fits-all
preset.

## EngineError

### EngineLaunchError

- Kind: error
- Source: `src/runtime/EngineError.ts:3`

Indicates that engine startup failed while initializing a runtime module.

### EngineConfigurationError

- Kind: error
- Source: `src/runtime/EngineError.ts:12`

Indicates that engine configuration was invalid before launch.

## Launch

### makeEngineLayer

- Kind: function
- Source: `src/runtime/Launch.ts:12`

Builds the smallest engine layer necessary to launch through a native
boundary.



Use this when you already know which additional services you want to provide
yourself and only need the validated [Engine](./llms/runtime.md#runtime-engine) service.

`makeRuntimeLayer` is the better default when you also want the standard
random source and fixed-step runtime clock.

### makeRuntimeLayer

- Kind: function
- Source: `src/runtime/Launch.ts:38`

Builds the standard runtime layer for most games.



This is the usual starting point for application authors. It bundles the
validated [Engine](./llms/runtime.md#runtime-engine), a deterministic [RandomSource](./llms/runtime.md#runtime-randomsource), and a
fixed-step [RuntimeClock](./llms/runtime.md#runtime-runtimeclock). Most games merge this layer with their own
state, scene, input, audio, graphics, and native frame services.

```ts
const runtimeLayer = makeRuntimeLayer(engineConfig, {
 nativeBoundaryLayer,
});
```

### engineProgram

- Kind: const
- Source: `src/runtime/Launch.ts:75`

Launches the active [Engine](./llms/runtime.md#runtime-engine) from the environment.



This program is useful when your surrounding application has already built
and provided an `Engine` service.

### seededEngineProgram

- Kind: function
- Source: `src/runtime/Launch.ts:89`

Launches the active engine while temporarily overriding randomness with the
provided config seed.



This is primarily useful for reproducible demos, tests, recordings, and
deterministic debugging sessions.

## RandomSource

### RandomSource

- Kind: service
- Source: `src/runtime/RandomSource.ts:3`

A thin deterministic randomness service for authored gameplay logic.



Use this instead of calling `Math.random()` directly when you want gameplay
tests and recordings to be reproducible from a seed.

#### Methods

- `seed: number | string | undefined`
- `next: Effect.Effect<number>`
- `nextBoolean: Effect.Effect<boolean>`
- `nextInt: Effect.Effect<number>`
- `nextIntBetween: ( minimum: number, maximum: number, ) => Effect.Effect<number>`
- `shuffle: <Value>( values: ReadonlyArray<Value>, ) => Effect.Effect<Array<Value>>`

### withRandomSeed

- Kind: function
- Source: `src/runtime/RandomSource.ts:45`

Runs an effect with a temporary deterministic random seed.



This is useful for one-off reproducible operations without rebuilding the
surrounding runtime layer.

## RuntimeClock

### RuntimeTimingSnapshot

- Kind: interface
- Source: `src/runtime/RuntimeClock.ts:3`

Snapshot data exposed by the runtime clock.



This is mainly useful for diagnostics, debug overlays, and tests that need
to assert how many fixed ticks or rendered frames have elapsed.

### RuntimeClock

- Kind: service
- Source: `src/runtime/RuntimeClock.ts:33`

Tracks frame timing and fixed-step sleep for a running game.



Most authored game code does not manipulate time directly. Instead, the
runtime uses `RuntimeClock` to:

- mark the start of each rendered frame with `beginFrame()`
- count fixed simulation ticks with `advanceTick()`
- expose timing data through `snapshot()`
- sleep for one configured fixed step with `sleepFixedStep`

This keeps frame pacing and diagnostics reproducible in tests while still
giving tools a simple place to read current timing state.

#### Methods

- `currentTimeMillis: Effect.Effect<number>`
- `beginFrame: () => Effect.Effect<void>`
- `advanceTick: () => Effect.Effect<void>`
- `reset: () => Effect.Effect<void>`
- `sleepFixedStep: Effect.Effect<void>`
- `snapshot: () => Effect.Effect<RuntimeTimingSnapshot>`