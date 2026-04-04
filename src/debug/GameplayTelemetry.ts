import { BunServices } from "@effect/platform-bun";
import {
	Cause,
	type Config,
	DateTime,
	Effect,
	Exit,
	Fiber,
	FileSystem,
	Formatter,
	Layer,
	Logger,
	Metric,
	Option,
	Path,
	Queue,
	Random,
	Schedule,
	Schema,
	type Scope,
	ServiceMap,
	Tracer,
} from "effect";
import type * as PlatformError from "effect/PlatformError";
import { CurrentLogAnnotations, CurrentLogSpans } from "effect/References";
import { OtlpResource } from "effect/unstable/observability";
import type { LogsData } from "effect/unstable/observability/OtlpLogger";
import type { MetricsData } from "effect/unstable/observability/OtlpMetrics";
import type { TraceData } from "effect/unstable/observability/OtlpTracer";
import {
	effect2dOtelRoot,
	effect2dOtelSessionDir,
} from "../config/telemetryEnvConfig.ts";
import {
	initializeGameplayMetrics,
	isGameplayMetricId,
} from "./GameplayMetrics.ts";

const defaultTelemetryServiceName = "effect2d-engine";

// Replace any run of path-unsafe characters so game ids become stable folder names.
const pathUnsafeCharacterPattern = /[^a-z0-9-]+/gi;
// Collapse repeated dashes created by sanitization into a single separator.
const repeatedDashPattern = /-+/g;

// OTLP encodes span kinds and severities as fixed numeric enums; these values
// come from the OpenTelemetry spec, and we use the first severity number in
// each OTEL range (Trace=1, Debug=5, Info=9, Warn=13, Error=17, Fatal=21).
const spanKindToOtelKind = {
	client: 3,
	consumer: 5,
	internal: 1,
	producer: 4,
	server: 2,
} as const;

const severityNumberByLevel = {
	Debug: 5,
	Error: 17,
	Fatal: 21,
	Info: 9,
	Trace: 1,
	Warn: 13,
} as const;

type ExportedMetric =
	MetricsData["resourceMetrics"][number]["scopeMetrics"][number]["metrics"][number];
type ExportedMetricGauge = NonNullable<ExportedMetric["gauge"]>;
type ExportedMetricHistogram = NonNullable<ExportedMetric["histogram"]>;
type ExportedMetricSum = NonNullable<ExportedMetric["sum"]>;

function isKnownSeverityLevel(
	level: string,
): level is keyof typeof severityNumberByLevel {
	return Object.hasOwn(severityNumberByLevel, level);
}

function getSeverityNumber(
	level: string,
): 0 | (typeof severityNumberByLevel)[keyof typeof severityNumberByLevel] {
	return isKnownSeverityLevel(level) ? severityNumberByLevel[level] : 0;
}

/**
 * File locations and session metadata for one gameplay telemetry capture.
 *
 * @public
 */
export interface GameplayTelemetrySessionDescriptor {
	readonly commentaryFilePath: string;
	readonly gameDirectory: string;
	readonly gameId: string;
	readonly latestSessionFilePath: string;
	readonly logsFilePath: string;
	readonly manifestFilePath: string;
	readonly metricsFilePath: string;
	readonly sessionDirectory: string;
	readonly sessionId: string;
	readonly startedAtIso: string;
	readonly tracesFilePath: string;
}

/**
 * Configuration for the engine gameplay telemetry session layer.
 *
 * @public
 */
export interface GameplayTelemetryLayerOptions {
	readonly gameId: string;
	readonly outputRootDirectory?: string;
	readonly resourceAttributes?: Readonly<Record<string, unknown>>;
	readonly serviceName?: string;
	readonly serviceVersion?: string;
	readonly sessionDirectory?: string;
	readonly sessionId?: string;
}

/** A single timestamped gameplay commentary entry written alongside telemetry data. @public */
export interface GameplayCommentaryEntry {
	readonly gameId: string;
	readonly kind: "commentary";
	readonly recordedAtIso: string;
	readonly recordedAtUnixMillis: number;
	readonly sessionId: string;
	readonly text: string;
}

const GameplayTelemetrySessionDescriptorSchema = Schema.Struct({
	commentaryFilePath: Schema.String,
	gameDirectory: Schema.String,
	gameId: Schema.String,
	latestSessionFilePath: Schema.String,
	logsFilePath: Schema.String,
	manifestFilePath: Schema.String,
	metricsFilePath: Schema.String,
	sessionDirectory: Schema.String,
	sessionId: Schema.String,
	startedAtIso: Schema.String,
	tracesFilePath: Schema.String,
});

const LatestGameplayTelemetrySessionSchema = Schema.Struct({
	gameId: Schema.String,
	sessionDirectory: Schema.String,
	sessionId: Schema.String,
	updatedAtIso: Schema.String,
});

interface GameplayTelemetryWriter {
	readonly filePath: string;
	readonly queue: Queue.Queue<string, Cause.Done>;
	readonly workerFiber: Fiber.Fiber<void, PlatformError.PlatformError>;
}

/**
 * Local OTEL-backed telemetry services for playable sessions and sample games.
 *
 * @public
 */
export class GameplayTelemetrySession extends ServiceMap.Service<
	GameplayTelemetrySession,
	{
		readonly descriptor: GameplayTelemetrySessionDescriptor;
		readonly metricsStartTimeUnixNano: string;
		readonly resource: ReturnType<typeof OtlpResource.make>;
		readonly scope: {
			readonly name: string;
			readonly version?: string;
		};
		readonly writeLogs: (data: LogsData) => void;
		readonly writeMetrics: (data: MetricsData) => void;
		readonly writeTraces: (data: TraceData) => void;
	}
>()("effect2d/debug/GameplayTelemetry/GameplayTelemetrySession") {
	static readonly layer = (options: GameplayTelemetryLayerOptions) =>
		Layer.effect(
			GameplayTelemetrySession,
			Effect.acquireRelease(
				createGameplayTelemetrySessionRuntime(options).pipe(
					Effect.tap((runtime) =>
						Effect.sync(() => {
							emitGameplayTelemetrySessionStarted(runtime);
						}),
					),
					Effect.orDie,
				),
				(runtime) =>
					Effect.gen(function* () {
						yield* shutdownGameplayTelemetryWriter(runtime.logsWriter).pipe(
							Effect.orDie,
						);
						yield* shutdownGameplayTelemetryWriter(runtime.metricsWriter).pipe(
							Effect.orDie,
						);
						yield* shutdownGameplayTelemetryWriter(runtime.tracesWriter).pipe(
							Effect.orDie,
						);
					}),
			),
		).pipe(Layer.provide(BunServices.layer));

	static readonly observabilityLayer = (
		options: GameplayTelemetryLayerOptions,
	): Layer.Layer<GameplayTelemetrySession> => {
		const sessionLayer = GameplayTelemetrySession.layer(options);
		const loggerLayer = Logger.layer(
			[
				Effect.gen(function* () {
					const session = yield* GameplayTelemetrySession;
					return makeGameplayTelemetryLogger(session);
				}),
			],
			{
				mergeWithExisting: false,
			},
		).pipe(Layer.provide(sessionLayer));
		const tracerLayer = Layer.effect(
			Tracer.Tracer,
			Effect.gen(function* () {
				const session = yield* GameplayTelemetrySession;
				return makeGameplayTelemetryTracer(session);
			}),
		).pipe(Layer.provide(sessionLayer));
		const metricsLayer = Layer.effectDiscard(
			Effect.gen(function* () {
				const session = yield* GameplayTelemetrySession;
				const services = yield* Effect.services<never>();

				yield* initializeGameplayMetrics;
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => {
						flushGameplayTelemetryMetrics(session, services);
					}),
				);
				yield* Effect.repeat(
					Effect.sync(() => {
						flushGameplayTelemetryMetrics(session, services);
					}),
					Schedule.spaced("1 second"),
				).pipe(Effect.forkScoped);
			}),
		).pipe(Layer.provide(sessionLayer));

		return Layer.mergeAll(sessionLayer, loggerLayer, tracerLayer, metricsLayer);
	};
}

interface GameplayTelemetrySessionRuntime {
	readonly descriptor: GameplayTelemetrySessionDescriptor;
	readonly logsWriter: GameplayTelemetryWriter;
	readonly metricsStartTimeUnixNano: string;
	readonly metricsWriter: GameplayTelemetryWriter;
	readonly resource: ReturnType<typeof OtlpResource.make>;
	readonly scope: {
		readonly name: string;
		readonly version?: string;
	};
	readonly tracesWriter: GameplayTelemetryWriter;
	readonly writeLogs: (data: LogsData) => void;
	readonly writeMetrics: (data: MetricsData) => void;
	readonly writeTraces: (data: TraceData) => void;
}

interface GameplayTelemetrySpan extends Tracer.Span {
	readonly attributes: Map<string, unknown>;
	readonly events: Array<{
		readonly attributes?: Readonly<Record<string, unknown>>;
		readonly name: string;
		readonly startTime: bigint;
	}>;
	readonly export: (span: GameplayTelemetrySpan) => void;
	readonly links: Array<Tracer.SpanLink>;
	status: Tracer.SpanStatus;
}

function isEndedGameplayTelemetrySpanStatus(
	status: Tracer.SpanStatus,
): status is Extract<Tracer.SpanStatus, { readonly endTime: bigint }> {
	return "endTime" in status;
}

export function sanitizeTelemetryGameId(gameId: string): string {
	const normalized = gameId
		.trim()
		.replaceAll("/", "-")
		.replace(pathUnsafeCharacterPattern, "-")
		.replace(repeatedDashPattern, "-")
		.toLowerCase();

	if (normalized.startsWith("-")) {
		if (normalized.endsWith("-")) {
			return normalized.slice(1, -1);
		}

		return normalized.slice(1);
	}

	if (normalized.endsWith("-")) {
		return normalized.slice(0, -1);
	}

	return normalized;
}

/**
 * Creates or reuses a gameplay telemetry session directory and manifest.
 *
 * @public
 */
export const createGameplayTelemetrySessionDescriptor: (
	options: GameplayTelemetryLayerOptions,
) => Effect.Effect<
	GameplayTelemetrySessionDescriptor,
	Config.ConfigError | PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function* (options: GameplayTelemetryLayerOptions) {
	const path = yield* Path.Path;
	const startedAt = yield* DateTime.now;
	const startedAtIso = DateTime.formatIso(startedAt);
	const sanitizedGameId = sanitizeTelemetryGameId(options.gameId);
	const maybeOtelRoot = yield* effect2dOtelRoot;
	const outputRootDirectory = resolveTelemetryRootDirectory(
		path,
		options.outputRootDirectory,
		Option.getOrUndefined(maybeOtelRoot),
	);
	const gameDirectory = path.join(outputRootDirectory, sanitizedGameId);
	const maybeSessionDirFromEnv = yield* effect2dOtelSessionDir;
	const requestedSessionDirectory =
		options.sessionDirectory ?? Option.getOrUndefined(maybeSessionDirFromEnv);

	if (requestedSessionDirectory !== undefined) {
		const existingDescriptor =
			yield* resolveGameplayTelemetrySessionDescriptorFromDirectory(
				requestedSessionDirectory,
			);
		if (existingDescriptor !== null) {
			return existingDescriptor;
		}
	}

	const sessionId = options.sessionId ?? (yield* Random.nextUUIDv4);
	const sessionDirectory = path.resolve(
		requestedSessionDirectory ??
			path.join(
				gameDirectory,
				`${startedAtIso.replaceAll(":", "-").replaceAll(".", "-")}-${sessionId}`,
			),
	);
	const latestSessionFilePath = path.join(gameDirectory, "latest-session.json");
	const descriptor = {
		commentaryFilePath: path.join(sessionDirectory, "commentary.ndjson"),
		gameDirectory,
		gameId: options.gameId,
		latestSessionFilePath,
		logsFilePath: path.join(sessionDirectory, "otel-logs.ndjson"),
		manifestFilePath: path.join(sessionDirectory, "session.json"),
		metricsFilePath: path.join(sessionDirectory, "otel-metrics.ndjson"),
		sessionDirectory,
		sessionId,
		startedAtIso,
		tracesFilePath: path.join(sessionDirectory, "otel-traces.ndjson"),
	} satisfies GameplayTelemetrySessionDescriptor;

	yield* ensureGameplayTelemetrySessionFiles(descriptor);

	return descriptor;
});

/**
 * Reads one telemetry session manifest from a known session directory.
 *
 * @public
 */
export const resolveGameplayTelemetrySessionDescriptorFromDirectory: (
	sessionDirectory: string,
) => Effect.Effect<
	GameplayTelemetrySessionDescriptor | null,
	PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function* (sessionDirectory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const manifestFilePath = path.join(
		path.resolve(sessionDirectory),
		"session.json",
	);
	const exists = yield* fs.exists(manifestFilePath);
	if (!exists) {
		return null;
	}

	const manifest = yield* fs.readFileString(manifestFilePath);
	return yield* Schema.decodeUnknownEffect(
		Schema.fromJsonString(GameplayTelemetrySessionDescriptorSchema),
	)(manifest);
});

/**
 * Resolves the most recent telemetry session for the provided game id.
 *
 * @public
 */
export const resolveLatestGameplayTelemetrySessionDescriptor: (
	gameId: string,
	options?: {
		readonly outputRootDirectory?: string;
	},
) => Effect.Effect<
	GameplayTelemetrySessionDescriptor | null,
	Config.ConfigError | PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function* (
	gameId: string,
	options?: {
		readonly outputRootDirectory?: string;
	},
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const maybeOtelRoot = yield* effect2dOtelRoot;
	const outputRootDirectory = resolveTelemetryRootDirectory(
		path,
		options?.outputRootDirectory,
		Option.getOrUndefined(maybeOtelRoot),
	);
	const latestSessionFilePath = path.join(
		outputRootDirectory,
		sanitizeTelemetryGameId(gameId),
		"latest-session.json",
	);

	const exists = yield* fs.exists(latestSessionFilePath);
	if (!exists) {
		return null;
	}

	const latestSessionText = yield* fs.readFileString(latestSessionFilePath);
	const latestSession = yield* Schema.decodeUnknownEffect(
		Schema.fromJsonString(LatestGameplayTelemetrySessionSchema),
	)(latestSessionText);

	return yield* resolveGameplayTelemetrySessionDescriptorFromDirectory(
		latestSession.sessionDirectory,
	);
});

/**
 * Appends one timestamped gameplay commentary entry to the active session.
 *
 * @public
 */
export const appendGameplayCommentaryEntry: (options: {
	readonly gameId: string;
	readonly outputRootDirectory?: string;
	readonly sessionDirectory?: string;
	readonly text: string;
}) => Effect.Effect<
	GameplayCommentaryEntry & {
		readonly commentaryFilePath: string;
	},
	Config.ConfigError | PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function* (options: {
	readonly gameId: string;
	readonly outputRootDirectory?: string;
	readonly sessionDirectory?: string;
	readonly text: string;
}) {
	let descriptor: GameplayTelemetrySessionDescriptor | null;
	if (options.sessionDirectory === undefined) {
		descriptor = yield* resolveLatestGameplayTelemetrySessionDescriptor(
			options.gameId,
			{
				outputRootDirectory: options.outputRootDirectory,
			},
		);
		if (descriptor === null) {
			descriptor = yield* createGameplayTelemetrySessionDescriptor({
				gameId: options.gameId,
				outputRootDirectory: options.outputRootDirectory,
			});
		}
	} else {
		descriptor = yield* resolveGameplayTelemetrySessionDescriptorFromDirectory(
			options.sessionDirectory,
		);
		if (descriptor === null) {
			descriptor = yield* createGameplayTelemetrySessionDescriptor({
				gameId: options.gameId,
				outputRootDirectory: options.outputRootDirectory,
				sessionDirectory: options.sessionDirectory,
			});
		}
	}

	const recordedAt = yield* DateTime.now;
	const entry = {
		gameId: descriptor.gameId,
		kind: "commentary",
		recordedAtIso: DateTime.formatIso(recordedAt),
		recordedAtUnixMillis: DateTime.toEpochMillis(recordedAt),
		sessionId: descriptor.sessionId,
		text: options.text,
	} satisfies GameplayCommentaryEntry;

	yield* appendJsonLineToFile(descriptor.commentaryFilePath, entry);

	return {
		...entry,
		commentaryFilePath: descriptor.commentaryFilePath,
	};
});

const ensureGameplayTelemetrySessionFiles: (
	descriptor: GameplayTelemetrySessionDescriptor,
) => Effect.Effect<
	void,
	PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function* (
	descriptor: GameplayTelemetrySessionDescriptor,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const updatedAt = yield* DateTime.now;

	yield* fs.makeDirectory(descriptor.gameDirectory, { recursive: true });
	yield* fs.makeDirectory(descriptor.sessionDirectory, { recursive: true });

	for (const filePath of [
		descriptor.commentaryFilePath,
		descriptor.logsFilePath,
		descriptor.metricsFilePath,
		descriptor.tracesFilePath,
	]) {
		yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
		yield* fs.writeFileString(filePath, "", { flag: "a+" });
	}

	yield* fs.writeFileString(
		descriptor.manifestFilePath,
		`${Formatter.formatJson(descriptor, { space: 2 })}\n`,
	);
	yield* fs.writeFileString(
		descriptor.latestSessionFilePath,
		`${Formatter.formatJson(
			{
				gameId: descriptor.gameId,
				sessionDirectory: descriptor.sessionDirectory,
				sessionId: descriptor.sessionId,
				updatedAtIso: DateTime.formatIso(updatedAt),
			},
			{ space: 2 },
		)}\n`,
	);
});

const createGameplayTelemetrySessionRuntime: (
	options: GameplayTelemetryLayerOptions,
) => Effect.Effect<
	GameplayTelemetrySessionRuntime,
	Config.ConfigError | PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem | Path.Path | Scope.Scope
> = Effect.fnUntraced(function* (options: GameplayTelemetryLayerOptions) {
	const descriptor = yield* createGameplayTelemetrySessionDescriptor(options);
	const logsWriter = yield* makeGameplayTelemetryWriter(
		descriptor.logsFilePath,
	);
	const metricsWriter = yield* makeGameplayTelemetryWriter(
		descriptor.metricsFilePath,
	);
	const tracesWriter = yield* makeGameplayTelemetryWriter(
		descriptor.tracesFilePath,
	);
	const metricsStartTimeUnixNano = String(
		BigInt(
			DateTime.toEpochMillis(DateTime.makeUnsafe(descriptor.startedAtIso)),
		) * 1_000_000n,
	);
	const resource = OtlpResource.make({
		attributes: {
			"effect2d.game.id": descriptor.gameId,
			"effect2d.session.directory": descriptor.sessionDirectory,
			"effect2d.session.id": descriptor.sessionId,
			"effect2d.telemetry.audience": "engine-developers",
			"effect2d.telemetry.storage": "filesystem",
			"effect2d.telemetry.stream": "engine",
			"process.runtime.name": "bun",
			...options.resourceAttributes,
		},
		serviceName: options.serviceName ?? defaultTelemetryServiceName,
		serviceVersion: options.serviceVersion,
	});
	const scope = {
		name: `${options.serviceName ?? defaultTelemetryServiceName}.local-filesystem`,
		version: options.serviceVersion,
	};

	return {
		descriptor,
		logsWriter,
		metricsStartTimeUnixNano,
		metricsWriter,
		resource,
		scope,
		tracesWriter,
		writeLogs: (data: LogsData) => {
			appendTelemetryLine(logsWriter, data);
		},
		writeMetrics: (data: MetricsData) => {
			appendTelemetryLine(metricsWriter, data);
		},
		writeTraces: (data: TraceData) => {
			appendTelemetryLine(tracesWriter, data);
		},
	};
});

function resolveTelemetryRootDirectory(
	path: Path.Path,
	outputRootDirectory: string | undefined,
	otelRootFromEnv: string | undefined,
): string {
	return path.resolve(
		outputRootDirectory ??
			otelRootFromEnv ??
			path.join(process.cwd(), ".effect2d", "otel"),
	);
}

const makeGameplayTelemetryWriter: (
	filePath: string,
) => Effect.Effect<
	GameplayTelemetryWriter,
	PlatformError.PlatformError,
	FileSystem.FileSystem | Scope.Scope
> = Effect.fnUntraced(function* (filePath: string) {
	const queue = yield* Queue.unbounded<string, Cause.Done>();
	const workerFiber = yield* Effect.forever(
		Effect.flatMap(Queue.take(queue), (line) =>
			appendTextLineToFile(filePath, line),
		),
	).pipe(
		Effect.catchIf(Cause.isDone, () => Effect.void),
		Effect.forkScoped,
	);

	return {
		filePath,
		queue,
		workerFiber,
	};
});

const shutdownGameplayTelemetryWriter: (
	writer: GameplayTelemetryWriter,
) => Effect.Effect<void, PlatformError.PlatformError> = Effect.fnUntraced(
	function* (writer: GameplayTelemetryWriter) {
		yield* Queue.end(writer.queue);
		yield* Fiber.join(writer.workerFiber);
	},
);

const appendJsonLineToFile: (
	filePath: string,
	value: unknown,
) => Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> =
	Effect.fnUntraced(function* (filePath: string, value: unknown) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.writeFileString(filePath, formatJsonLine(value), {
			flag: "a+",
		});
	});

const appendTextLineToFile: (
	filePath: string,
	value: string,
) => Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> =
	Effect.fnUntraced(function* (filePath: string, value: string) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.writeFileString(filePath, value, {
			flag: "a+",
		});
	});

function formatJsonLine(value: unknown): string {
	return `${Formatter.formatJson(value)}\n`;
}

function appendTelemetryLine(
	writer: GameplayTelemetryWriter,
	value: unknown,
): void {
	Queue.offerUnsafe(writer.queue, formatJsonLine(value));
}

function makeGameplayTelemetryLogger(session: {
	readonly resource: ReturnType<typeof OtlpResource.make>;
	readonly scope: {
		readonly name: string;
		readonly version?: string;
	};
	readonly writeLogs: (data: LogsData) => void;
}): Logger.Logger<unknown, void> {
	return Logger.make((options) => {
		const timestampNanos = BigInt(options.date.getTime()) * 1_000_000n;
		const logDateTime = DateTime.makeUnsafe(options.date);
		const attributes = OtlpResource.entriesToAttributes(
			Object.entries(options.fiber.getRef(CurrentLogAnnotations)),
		);
		attributes.push(
			{
				key: "effect2d.time_iso",
				value: { stringValue: DateTime.formatIso(logDateTime) },
			},
			{
				key: "fiber.id",
				value: { intValue: options.fiber.id },
			},
		);

		for (const [label, startTime] of options.fiber.getRef(CurrentLogSpans)) {
			attributes.push({
				key: `effect2d.log_span.${label}`,
				value: { stringValue: `${options.date.getTime() - startTime}ms` },
			});
		}

		if (options.cause.reasons.length > 0) {
			attributes.push({
				key: "log.error",
				value: { stringValue: Cause.pretty(options.cause) },
			});
		}

		const message = Array.isArray(options.message)
			? options.message
			: [options.message];
		const severityText = String(options.logLevel);
		const logRecord = {
			attributes,
			body: OtlpResource.unknownToAttributeValue(
				message.length === 1 ? message[0] : message,
			),
			droppedAttributesCount: 0,
			observedTimeUnixNano: String(timestampNanos),
			severityNumber: getSeverityNumber(severityText),
			severityText,
			timeUnixNano: String(timestampNanos),
			...(options.fiber.currentSpan === undefined
				? {}
				: {
						spanId: options.fiber.currentSpan.spanId,
						traceId: options.fiber.currentSpan.traceId,
					}),
		};

		session.writeLogs({
			resourceLogs: [
				{
					resource: session.resource,
					scopeLogs: [
						{
							scope: session.scope,
							logRecords: [logRecord],
						},
					],
				},
			],
		});
	});
}

const otelCumulativeAggregationTemporality = 2;
const telemetrySessionDurationMetricName =
	"effect2d.telemetry_session_duration_ms";

function flushGameplayTelemetryMetrics(
	session: {
		readonly descriptor: GameplayTelemetrySessionDescriptor;
		readonly metricsStartTimeUnixNano: string;
		readonly resource: ReturnType<typeof OtlpResource.make>;
		readonly scope: {
			readonly name: string;
			readonly version?: string;
		};
		readonly writeMetrics: (data: MetricsData) => void;
	},
	services: ServiceMap.ServiceMap<never>,
): void {
	const snapshots = Metric.snapshotUnsafe(services).filter((snapshot) =>
		isGameplayMetricId(snapshot.id),
	);
	const exportedAt = DateTime.nowUnsafe();
	const exportedAtIso = DateTime.formatIso(exportedAt);
	const timeUnixNano = String(
		BigInt(DateTime.toEpochMillis(exportedAt)) * 1_000_000n,
	);
	const metricsByName = new Map<string, ExportedMetric>();

	for (const snapshot of snapshots) {
		const unit =
			snapshot.attributes?.["unit"] ??
			snapshot.attributes?.["time_unit"] ??
			"1";
		const attributes = OtlpResource.entriesToAttributes(
			Object.entries({
				...(snapshot.attributes ?? {}),
				"effect2d.start_time_iso": session.descriptor.startedAtIso,
				"effect2d.time_iso": exportedAtIso,
			}),
		);
		const existingMetric: ExportedMetric = metricsByName.get(snapshot.id) ?? {
			description: snapshot.description,
			name: snapshot.id,
			unit,
		};

		switch (snapshot.type) {
			case "Counter": {
				const sum: ExportedMetricSum = existingMetric.sum ?? {
					aggregationTemporality: otelCumulativeAggregationTemporality,
					dataPoints: [],
					isMonotonic: snapshot.state.incremental,
				};
				sum.dataPoints.push({
					attributes,
					startTimeUnixNano: session.metricsStartTimeUnixNano,
					timeUnixNano,
					...(typeof snapshot.state.count === "bigint"
						? {
								asInt: Number(snapshot.state.count),
							}
						: {
								asDouble: snapshot.state.count,
							}),
				});
				existingMetric.sum = sum;
				break;
			}
			case "Gauge": {
				const gauge: ExportedMetricGauge = existingMetric.gauge ?? {
					dataPoints: [],
				};
				gauge.dataPoints.push({
					attributes,
					startTimeUnixNano: session.metricsStartTimeUnixNano,
					timeUnixNano,
					...(typeof snapshot.state.value === "bigint"
						? {
								asInt: Number(snapshot.state.value),
							}
						: {
								asDouble: snapshot.state.value,
							}),
				});
				existingMetric.gauge = gauge;
				break;
			}
			case "Histogram": {
				const bucketCounts: Array<number> = [];
				const explicitBounds: Array<number> = [];
				let previousBucketCount = 0;

				for (let index = 0; index < snapshot.state.buckets.length; index += 1) {
					const bucket = snapshot.state.buckets[index];
					if (bucket === undefined) {
						continue;
					}
					const [boundary, cumulativeCount] = bucket;
					if (index < snapshot.state.buckets.length - 1) {
						explicitBounds.push(boundary);
					}
					bucketCounts.push(cumulativeCount - previousBucketCount);
					previousBucketCount = cumulativeCount;
				}

				const histogram: ExportedMetricHistogram = existingMetric.histogram ?? {
					aggregationTemporality: otelCumulativeAggregationTemporality,
					dataPoints: [],
				};
				histogram.dataPoints.push({
					attributes,
					bucketCounts,
					count: snapshot.state.count,
					explicitBounds,
					max: snapshot.state.max,
					min: snapshot.state.min,
					startTimeUnixNano: session.metricsStartTimeUnixNano,
					sum: snapshot.state.sum,
					timeUnixNano,
				});
				existingMetric.histogram = histogram;
				break;
			}
			case "Frequency":
			case "Summary":
				continue;
		}

		metricsByName.set(snapshot.id, existingMetric);
	}

	metricsByName.set(
		telemetrySessionDurationMetricName,
		makeTelemetrySessionDurationMetric({
			exportedAt,
			exportedAtIso,
			session,
			timeUnixNano,
		}),
	);

	const metricsData: MetricsData = {
		resourceMetrics: [
			{
				resource: session.resource,
				scopeMetrics: [
					{
						metrics: Array.from(metricsByName.values()),
						scope: session.scope,
					},
				],
			},
		],
	};
	session.writeMetrics(metricsData);
}

function emitGameplayTelemetrySessionStarted(session: {
	readonly descriptor: GameplayTelemetrySessionDescriptor;
	readonly resource: ReturnType<typeof OtlpResource.make>;
	readonly scope: {
		readonly name: string;
		readonly version?: string;
	};
	readonly writeLogs: (data: LogsData) => void;
	readonly writeTraces: (data: TraceData) => void;
}): void {
	const startedAtNanos =
		BigInt(
			DateTime.toEpochMillis(
				DateTime.makeUnsafe(session.descriptor.startedAtIso),
			),
		) * 1_000_000n;
	const exportedAt = DateTime.nowUnsafe();
	const exportedAtIso = DateTime.formatIso(exportedAt);
	const exportedAtNanos =
		BigInt(DateTime.toEpochMillis(exportedAt)) * 1_000_000n;
	const startupAttributes = OtlpResource.entriesToAttributes([
		["effect2d.session.id", session.descriptor.sessionId],
		["effect2d.telemetry.event", "session-start"],
		["effect2d.time_iso", exportedAtIso],
	]);

	session.writeLogs({
		resourceLogs: [
			{
				resource: session.resource,
				scopeLogs: [
					{
						scope: session.scope,
						logRecords: [
							{
								attributes: startupAttributes,
								body: {
									stringValue: `Gameplay telemetry session started for ${session.descriptor.gameId}.`,
								},
								droppedAttributesCount: 0,
								observedTimeUnixNano: String(exportedAtNanos),
								severityNumber: severityNumberByLevel.Info,
								severityText: "Info",
								timeUnixNano: String(exportedAtNanos),
							},
						],
					},
				],
			},
		],
	});

	session.writeTraces({
		resourceSpans: [
			{
				resource: session.resource,
				scopeSpans: [
					{
						scope: session.scope,
						spans: [
							{
								attributes: startupAttributes,
								droppedAttributesCount: 0,
								droppedEventsCount: 0,
								droppedLinksCount: 0,
								endTimeUnixNano: String(exportedAtNanos),
								events: [],
								kind: spanKindToOtelKind.internal,
								links: [],
								name: "GameplayTelemetry.session-start",
								parentSpanId: undefined,
								spanId: generateTelemetryId(16),
								startTimeUnixNano: String(startedAtNanos),
								status: { code: 1 },
								traceId: generateTelemetryId(32),
							},
						],
					},
				],
			},
		],
	});
}

function makeTelemetrySessionDurationMetric(options: {
	readonly exportedAt: DateTime.DateTime;
	readonly exportedAtIso: string;
	readonly session: {
		readonly descriptor: GameplayTelemetrySessionDescriptor;
		readonly metricsStartTimeUnixNano: string;
	};
	readonly timeUnixNano: string;
}): ExportedMetric {
	return {
		description:
			"Elapsed gameplay telemetry session duration in milliseconds exported as a heartbeat gauge.",
		gauge: {
			dataPoints: [
				{
					attributes: OtlpResource.entriesToAttributes(
						Object.entries({
							"effect2d.start_time_iso":
								options.session.descriptor.startedAtIso,
							"effect2d.telemetry.metric_kind": "heartbeat",
							"effect2d.time_iso": options.exportedAtIso,
							unit: "ms",
						}),
					),
					asDouble: Math.max(
						0,
						DateTime.toEpochMillis(options.exportedAt) -
							DateTime.toEpochMillis(
								DateTime.makeUnsafe(options.session.descriptor.startedAtIso),
							),
					),
					startTimeUnixNano: options.session.metricsStartTimeUnixNano,
					timeUnixNano: options.timeUnixNano,
				},
			],
		},
		name: telemetrySessionDurationMetricName,
		unit: "ms",
	};
}

function makeGameplayTelemetryTracer(session: {
	readonly resource: ReturnType<typeof OtlpResource.make>;
	readonly scope: {
		readonly name: string;
		readonly version?: string;
	};
	readonly writeTraces: (data: TraceData) => void;
}): Tracer.Tracer {
	const exportSpan = (span: GameplayTelemetrySpan) => {
		if (!span.sampled || !isEndedGameplayTelemetrySpanStatus(span.status)) {
			return;
		}

		const startTimeIso = nanosToIso(span.status.startTime);
		const endTimeIso = nanosToIso(span.status.endTime);
		const attributes = OtlpResource.entriesToAttributes(
			span.attributes.entries(),
		);
		attributes.push(
			{
				key: "effect2d.duration_ms",
				value: {
					doubleValue:
						Number(span.status.endTime - span.status.startTime) / 1_000_000,
				},
			},
			{
				key: "effect2d.end_time_iso",
				value: { stringValue: endTimeIso },
			},
			{
				key: "effect2d.start_time_iso",
				value: { stringValue: startTimeIso },
			},
		);

		const events = span.events.map((event) => ({
			attributes: OtlpResource.entriesToAttributes(
				Object.entries({
					...(event.attributes ?? {}),
					"effect2d.event_time_iso": nanosToIso(event.startTime),
				}),
			),
			droppedAttributesCount: 0,
			name: event.name,
			timeUnixNano: String(event.startTime),
		}));

		let otelStatus: {
			readonly code: 1 | 2;
			readonly message?: string;
		} = { code: 1 };

		if (Exit.isFailure(span.status.exit)) {
			if (Cause.hasInterruptsOnly(span.status.exit.cause)) {
				otelStatus = {
					code: 1,
					message: "Interrupted",
				};
				attributes.push({
					key: "status.interrupted",
					value: { boolValue: true },
				});
			} else {
				otelStatus = { code: 2 };
				for (const error of Cause.prettyErrors(span.status.exit.cause)) {
					if (otelStatus.message === undefined) {
						otelStatus = {
							code: 2,
							message: error.message,
						};
					}

					events.push({
						attributes: [
							{
								key: "exception.message",
								value: { stringValue: error.message },
							},
							{
								key: "exception.stacktrace",
								value: {
									stringValue: error.stack ?? "No stack trace available",
								},
							},
							{
								key: "exception.type",
								value: { stringValue: error.name },
							},
							{
								key: "effect2d.event_time_iso",
								value: { stringValue: endTimeIso },
							},
						],
						droppedAttributesCount: 0,
						name: "exception",
						timeUnixNano: String(span.status.endTime),
					});
				}
			}
		}

		session.writeTraces({
			resourceSpans: [
				{
					resource: session.resource,
					scopeSpans: [
						{
							scope: session.scope,
							spans: [
								{
									attributes,
									droppedAttributesCount: 0,
									droppedEventsCount: 0,
									droppedLinksCount: 0,
									endTimeUnixNano: String(span.status.endTime),
									events,
									kind: spanKindToOtelKind[span.kind],
									links: span.links.map((link) => ({
										attributes: OtlpResource.entriesToAttributes(
											Object.entries(link.attributes),
										),
										droppedAttributesCount: 0,
										spanId: link.span.spanId,
										traceId: link.span.traceId,
									})),
									name: span.name,
									parentSpanId: Option.isSome(span.parent)
										? span.parent.value.spanId
										: undefined,
									spanId: span.spanId,
									startTimeUnixNano: String(span.status.startTime),
									status: otelStatus,
									traceId: span.traceId,
								},
							],
						},
					],
				},
			],
		});
	};

	return Tracer.make({
		span(options) {
			return makeGameplayTelemetrySpan({
				...options,
				export: exportSpan,
				status: {
					_tag: "Started",
					startTime: options.startTime,
				},
			});
		},
	});
}

function makeGameplayTelemetrySpan(options: {
	readonly annotations: ServiceMap.ServiceMap<never>;
	readonly export: (span: GameplayTelemetrySpan) => void;
	readonly kind: Tracer.SpanKind;
	readonly links: ReadonlyArray<Tracer.SpanLink>;
	readonly name: string;
	readonly parent: Option.Option<Tracer.AnySpan>;
	readonly sampled: boolean;
	readonly status: Tracer.SpanStatus;
}): GameplayTelemetrySpan {
	const self: GameplayTelemetrySpan = {
		_tag: "Span",
		addLinks(links) {
			self.links.push(...links);
		},
		annotations: options.annotations,
		attribute(key, value) {
			self.attributes.set(key, value);
		},
		attributes: new Map<string, unknown>(),
		end(endTime, exit) {
			self.status = {
				_tag: "Ended",
				endTime,
				exit,
				startTime: self.status.startTime,
			};
			self.export(self);
		},
		event(name, startTime, attributes) {
			self.events.push({
				attributes,
				name,
				startTime,
			});
		},
		events: [],
		export: options.export,
		kind: options.kind,
		links: [...options.links],
		name: options.name,
		parent: options.parent,
		sampled: options.sampled,
		spanId: generateTelemetryId(16),
		status: options.status,
		traceId: Option.isSome(options.parent)
			? options.parent.value.traceId
			: generateTelemetryId(32),
	};

	return self;
}

function nanosToIso(nanos: bigint): string {
	return DateTime.formatIso(DateTime.makeUnsafe(Number(nanos / 1_000_000n)));
}

function generateTelemetryId(length: number): string {
	const source = Bun.randomUUIDv7().replaceAll("-", "");
	if (source.length >= length) {
		return source.slice(0, length);
	}

	let result = source;
	while (result.length < length) {
		result += Bun.randomUUIDv7().replaceAll("-", "");
	}
	return result.slice(0, length);
}
