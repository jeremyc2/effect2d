# Debug

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Debug API.

## DebugOverlay

### DebugRoomMarker

- Kind: interface
- Source: `src/debug/DebugOverlay.ts:13`

A room marker surfaced in the debug overlay.

### ResourceDiagnostic

- Kind: interface
- Source: `src/debug/DebugOverlay.ts:20`

A simplified resource status row surfaced in the debug overlay.

### FrameTimingDiagnostics

- Kind: interface
- Source: `src/debug/DebugOverlay.ts:27`

Timing numbers formatted for the debug overlay snapshot.

### DebugOverlaySnapshot

- Kind: interface
- Source: `src/debug/DebugOverlay.ts:36`

The complete diagnostic state captured by the debug overlay.



This combines timing, logs, scene stack information, collision bodies,
resource state, and optional camera metadata into one snapshot that tools or
tests can inspect.

### DebugOverlayDrawModel

- Kind: interface
- Source: `src/debug/DebugOverlay.ts:67`

A text-first representation of the debug overlay.



`lines` is the ready-to-render compact summary, while `snapshot` keeps the
full structured data for richer tooling.

## EngineLogger

### LogLevel

- Kind: type
- Source: `src/debug/EngineLogger.ts:3`

Structured log severities understood by the engine logger.



Available levels:
- `debug`
- `info`
- `warn`
- `error`

### LogEntry

- Kind: interface
- Source: `src/debug/EngineLogger.ts:16`

One structured log record captured by the engine logger.



`sequence` is monotonically increasing so tooling can preserve authored log
order without relying on wall-clock timestamps.

### InvalidLogMessageError

- Kind: error
- Source: `src/debug/EngineLogger.ts:75`

Indicates that a log call received an invalid message payload.

### EngineLogger

- Kind: service
- Source: `src/debug/EngineLogger.ts:84`

A small structured log service for gameplay diagnostics and debug tooling.



`EngineLogger` stores ordered in-memory log entries that other services such
as the debug overlay can inspect. Reach for it when you want reproducible,
test-friendly diagnostic events without coupling your game code to
`console.log`.

```ts
const logger = yield* EngineLogger;

yield* logger.info("Loaded room", { roomId: "cavern-entrance" });
```

#### Methods

- `clear: Effect.Effect<void>`
- `debug: ( message: string, context?: Readonly<Record<string, string | number | boolean>>, ) => Effect.Effect<void, InvalidLogMessageError>`
- `entries: Effect.Effect<ReadonlyArray<LogEntry>>`
- `error: ( message: string, context?: Readonly<Record<string, string | number | boolean>>, ) => Effect.Effect<void, InvalidLogMessageError>`
- `info: ( message: string, context?: Readonly<Record<string, string | number | boolean>>, ) => Effect.Effect<void, InvalidLogMessageError>`
- `warn: ( message: string, context?: Readonly<Record<string, string | number | boolean>>, ) => Effect.Effect<void, InvalidLogMessageError>`

## GameplayTelemetry

### GameplayTelemetrySessionDescriptor

- Kind: interface
- Source: `src/debug/GameplayTelemetry.ts:84`

File locations and session metadata for one gameplay telemetry capture.

### GameplayTelemetryLayerOptions

- Kind: interface
- Source: `src/debug/GameplayTelemetry.ts:103`

Configuration for the engine gameplay telemetry session layer.

### GameplayCommentaryEntry

- Kind: interface
- Source: `src/debug/GameplayTelemetry.ts:118`

A single timestamped gameplay commentary entry written alongside telemetry data.

### GameplayTelemetrySession

- Kind: service
- Source: `src/debug/GameplayTelemetry.ts:155`

Local OTEL-backed telemetry services for playable sessions and sample games.

#### Methods

- `descriptor: GameplayTelemetrySessionDescriptor`
- `metricsStartTimeUnixNano: string`
- `resource: ReturnType<typeof OtlpResource.make>`
- `scope: { readonly name: string`
- `writeLogs: (data: LogsData) => void`
- `writeMetrics: (data: MetricsData) => void`
- `writeTraces: (data: TraceData) => void`

### createGameplayTelemetrySessionDescriptor

- Kind: function
- Source: `src/debug/GameplayTelemetry.ts:305`

Creates or reuses a gameplay telemetry session directory and manifest.

### resolveGameplayTelemetrySessionDescriptorFromDirectory

- Kind: function
- Source: `src/debug/GameplayTelemetry.ts:371`

Reads one telemetry session manifest from a known session directory.

### resolveLatestGameplayTelemetrySessionDescriptor

- Kind: function
- Source: `src/debug/GameplayTelemetry.ts:400`

Resolves the most recent telemetry session for the provided game id.

### appendGameplayCommentaryEntry

- Kind: function
- Source: `src/debug/GameplayTelemetry.ts:449`

Appends one timestamped gameplay commentary entry to the active session.

## ResourceTracker

### ResourceKind

- Kind: type
- Source: `src/debug/ResourceTracker.ts:4`

Conventional resource categories used by the tracker.



Use these when you want the debug overlay and diagnostics to distinguish
images, audio, fonts, maps, or other authored assets.

### ResourceState

- Kind: type
- Source: `src/debug/ResourceTracker.ts:22`

Lifecycle state reported for one tracked resource.

### ResourceRecord

- Kind: interface
- Source: `src/debug/ResourceTracker.ts:25`

A diagnostic snapshot for one tracked resource entry.



`details` is free-form text for the last useful note you want surfaced in
tooling, such as an asset path or a failure reason.

### InvalidResourceRecordError

- Kind: error
- Source: `src/debug/ResourceTracker.ts:45`

Indicates that a tracked resource record was missing required data.

### UnknownTrackedResourceError

- Kind: error
- Source: `src/debug/ResourceTracker.ts:54`

Indicates that code referenced a tracked resource id that has not been registered.

### ResourceTracker

- Kind: service
- Source: `src/debug/ResourceTracker.ts:62`

Tracks high-level resource lifecycle state for diagnostics and debug UI.



Reach for `ResourceTracker` when your game loads authored assets or other
long-lived resources and you want a lightweight way to report whether each
resource is pending, loaded, faulted, or released. Cavern uses it so the
debug overlay can show asset health without coupling the overlay directly to
every loader.

Common usage flow:
1. `register` or `registerScoped` when a resource begins loading
2. `setLoaded` once it is ready
3. `fault` if loading fails
4. `release` when the resource is no longer live

```ts
const tracker = yield* ResourceTracker;

yield* tracker.register("title-screen", "image", "assets/title-screen.png");
yield* tracker.setLoaded("title-screen");
```

#### Methods

- `fault: ( id: string, details?: string, ) => Effect.Effect<void, UnknownTrackedResourceError>`
- `records: Effect.Effect<ReadonlyArray<ResourceRecord>>`
- `register: ( id: string, kind: ResourceKind, details?: string, ) => Effect.Effect<void, InvalidResourceRecordError>`
- `registerScoped: ( id: string, kind: ResourceKind, details?: string, ) => Effect.Effect<void, InvalidResourceRecordError, Scope.Scope>`
- `release: ( id: string, ) => Effect.Effect<void, UnknownTrackedResourceError>`
- `setLoaded: ( id: string, details?: string, ) => Effect.Effect<void, UnknownTrackedResourceError>`