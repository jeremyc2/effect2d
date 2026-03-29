import { describe, expect, test } from "bun:test";
import { BunServices } from "@effect/platform-bun";
import { Effect, FileSystem, Layer, Schema } from "effect";
import type * as PlatformError from "effect/PlatformError";
import { EngineLogger } from "./EngineLogger.ts";
import {
	recordFrameTime,
	recordInputEvent,
	recordRoomTransition,
	recordSaveRestore,
	recordSaveWrite,
	setActiveSfxCount,
	setCollisionBodyCount,
} from "./GameplayMetrics.ts";
import {
	appendGameplayCommentaryEntry,
	GameplayTelemetrySession,
	resolveLatestGameplayTelemetrySessionDescriptor,
} from "./GameplayTelemetry.ts";

const readNdjson: (
	path: string,
) => Effect.Effect<
	Array<unknown>,
	PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem
> = Effect.fnUntraced(function* (path: string) {
	const fs = yield* FileSystem.FileSystem;
	const contents = yield* fs.readFileString(path);
	const lines = contents
		.trim()
		.split("\n")
		.filter((line) => line.length > 0);
	const entries: Array<unknown> = [];

	for (const line of lines) {
		entries.push(
			yield* Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(line),
		);
	}

	return entries;
});

interface ParsedTelemetryAttribute {
	readonly key: string;
	readonly value: {
		readonly intValue?: number;
		readonly stringValue?: string;
	};
}

interface ParsedTelemetryLogBatch {
	readonly resourceLogs: ReadonlyArray<{
		readonly scopeLogs: ReadonlyArray<{
			readonly logRecords: ReadonlyArray<{
				readonly attributes: ReadonlyArray<ParsedTelemetryAttribute>;
				readonly body: {
					readonly stringValue?: string;
				};
			}>;
		}>;
	}>;
}

interface ParsedTelemetryTraceBatch {
	readonly resourceSpans: ReadonlyArray<{
		readonly scopeSpans: ReadonlyArray<{
			readonly spans: ReadonlyArray<{
				readonly attributes: ReadonlyArray<ParsedTelemetryAttribute>;
				readonly name: string;
			}>;
		}>;
	}>;
}

interface ParsedTelemetryMetricBatch {
	readonly resourceMetrics: ReadonlyArray<{
		readonly scopeMetrics: ReadonlyArray<{
			readonly metrics: ReadonlyArray<{
				readonly gauge?: {
					readonly dataPoints: ReadonlyArray<{
						readonly attributes: ReadonlyArray<ParsedTelemetryAttribute>;
					}>;
				};
				readonly histogram?: {
					readonly dataPoints: ReadonlyArray<{
						readonly attributes: ReadonlyArray<ParsedTelemetryAttribute>;
					}>;
				};
				readonly name: string;
				readonly sum?: {
					readonly dataPoints: ReadonlyArray<{
						readonly attributes: ReadonlyArray<ParsedTelemetryAttribute>;
					}>;
				};
			}>;
		}>;
	}>;
}

interface ParsedGameplayCommentaryEntry {
	readonly recordedAtIso: string;
	readonly sessionId: string;
	readonly text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectArray(value: unknown, context: string): ReadonlyArray<unknown> {
	expect(Array.isArray(value), `${context} must be an array.`).toBeTrue();
	return Array.isArray(value) ? value : [];
}

function assertDefined<T>(
	value: T | null | undefined,
): asserts value is NonNullable<T> {
	expect(value).toBeDefined();
	expect(value === null || value === undefined).toBeFalse();
}

function expectRecord(
	value: unknown,
	context: string,
): Record<string, unknown> {
	expect(isRecord(value), `${context} must be an object.`).toBeTrue();
	return isRecord(value) ? value : {};
}

function expectString(value: unknown, context: string): string {
	expect(typeof value === "string", `${context} must be a string.`).toBeTrue();
	return typeof value === "string" ? value : "";
}

function getOptionalNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function getOptionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function parseTelemetryAttribute(
	value: unknown,
	context: string,
): ParsedTelemetryAttribute {
	const record = expectRecord(value, context);
	const attributeValue = expectRecord(record["value"], `${context}.value`);
	const parsedValue: {
		intValue?: number;
		stringValue?: string;
	} = {};
	const intValue = getOptionalNumber(attributeValue["intValue"]);
	const stringValue = getOptionalString(attributeValue["stringValue"]);

	if (intValue !== undefined) {
		parsedValue.intValue = intValue;
	}
	if (stringValue !== undefined) {
		parsedValue.stringValue = stringValue;
	}

	return {
		key: expectString(record["key"], `${context}.key`),
		value: parsedValue,
	};
}

function parseTelemetryMetricSeries(
	value: unknown,
	context: string,
):
	| {
			readonly dataPoints: ReadonlyArray<{
				readonly attributes: ReadonlyArray<ParsedTelemetryAttribute>;
			}>;
	  }
	| undefined {
	if (value === undefined) {
		return undefined;
	}

	const record = expectRecord(value, context);
	return {
		dataPoints: expectArray(record["dataPoints"], `${context}.dataPoints`).map(
			(entry, index) => {
				const dataPoint = expectRecord(
					entry,
					`${context}.dataPoints[${index}]`,
				);
				return {
					attributes: expectArray(
						dataPoint["attributes"],
						`${context}.dataPoints[${index}].attributes`,
					).map((attribute, attributeIndex) =>
						parseTelemetryAttribute(
							attribute,
							`${context}.dataPoints[${index}].attributes[${attributeIndex}]`,
						),
					),
				};
			},
		),
	};
}

const readGameplayCommentaryEntries: (
	path: string,
) => Effect.Effect<
	Array<ParsedGameplayCommentaryEntry>,
	PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem
> = Effect.fnUntraced(function* (path: string) {
	return (yield* readNdjson(path)).map((entry, index) => {
		const record = expectRecord(entry, `commentary[${index}]`);
		return {
			recordedAtIso: expectString(
				record["recordedAtIso"],
				`commentary[${index}].recordedAtIso`,
			),
			sessionId: expectString(
				record["sessionId"],
				`commentary[${index}].sessionId`,
			),
			text: expectString(record["text"], `commentary[${index}].text`),
		};
	});
});

const readTelemetryLogBatches: (
	path: string,
) => Effect.Effect<
	Array<ParsedTelemetryLogBatch>,
	PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem
> = Effect.fnUntraced(function* (path: string) {
	return (yield* readNdjson(path)).map((entry, index) => {
		const record = expectRecord(entry, `logBatch[${index}]`);
		return {
			resourceLogs: expectArray(
				record["resourceLogs"],
				`logBatch[${index}].resourceLogs`,
			).map((resourceLog, resourceLogIndex) => {
				const resourceLogRecord = expectRecord(
					resourceLog,
					`logBatch[${index}].resourceLogs[${resourceLogIndex}]`,
				);
				return {
					scopeLogs: expectArray(
						resourceLogRecord["scopeLogs"],
						`logBatch[${index}].resourceLogs[${resourceLogIndex}].scopeLogs`,
					).map((scopeLog, scopeLogIndex) => {
						const scopeLogRecord = expectRecord(
							scopeLog,
							`logBatch[${index}].resourceLogs[${resourceLogIndex}].scopeLogs[${scopeLogIndex}]`,
						);
						return {
							logRecords: expectArray(
								scopeLogRecord["logRecords"],
								`logBatch[${index}].resourceLogs[${resourceLogIndex}].scopeLogs[${scopeLogIndex}].logRecords`,
							).map((logRecord, logRecordIndex) => {
								const parsedLogRecord = expectRecord(
									logRecord,
									`logBatch[${index}].resourceLogs[${resourceLogIndex}].scopeLogs[${scopeLogIndex}].logRecords[${logRecordIndex}]`,
								);
								const body = expectRecord(
									parsedLogRecord["body"],
									`logBatch[${index}].resourceLogs[${resourceLogIndex}].scopeLogs[${scopeLogIndex}].logRecords[${logRecordIndex}].body`,
								);
								return {
									attributes: expectArray(
										parsedLogRecord["attributes"],
										`logBatch[${index}].resourceLogs[${resourceLogIndex}].scopeLogs[${scopeLogIndex}].logRecords[${logRecordIndex}].attributes`,
									).map((attribute, attributeIndex) =>
										parseTelemetryAttribute(
											attribute,
											`logBatch[${index}].resourceLogs[${resourceLogIndex}].scopeLogs[${scopeLogIndex}].logRecords[${logRecordIndex}].attributes[${attributeIndex}]`,
										),
									),
									body: {
										stringValue: getOptionalString(body["stringValue"]),
									},
								};
							}),
						};
					}),
				};
			}),
		};
	});
});

const readTelemetryMetricBatches: (
	path: string,
) => Effect.Effect<
	Array<ParsedTelemetryMetricBatch>,
	PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem
> = Effect.fnUntraced(function* (path: string) {
	return (yield* readNdjson(path)).map((entry, index) => {
		const record = expectRecord(entry, `metricBatch[${index}]`);
		return {
			resourceMetrics: expectArray(
				record["resourceMetrics"],
				`metricBatch[${index}].resourceMetrics`,
			).map((resourceMetric, resourceMetricIndex) => {
				const resourceMetricRecord = expectRecord(
					resourceMetric,
					`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}]`,
				);
				return {
					scopeMetrics: expectArray(
						resourceMetricRecord["scopeMetrics"],
						`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics`,
					).map((scopeMetric, scopeMetricIndex) => {
						const scopeMetricRecord = expectRecord(
							scopeMetric,
							`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics[${scopeMetricIndex}]`,
						);
						return {
							metrics: expectArray(
								scopeMetricRecord["metrics"],
								`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics[${scopeMetricIndex}].metrics`,
							).map((metric, metricIndex) => {
								const metricRecord = expectRecord(
									metric,
									`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics[${scopeMetricIndex}].metrics[${metricIndex}]`,
								);
								return {
									gauge: parseTelemetryMetricSeries(
										metricRecord["gauge"],
										`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics[${scopeMetricIndex}].metrics[${metricIndex}].gauge`,
									),
									histogram: parseTelemetryMetricSeries(
										metricRecord["histogram"],
										`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics[${scopeMetricIndex}].metrics[${metricIndex}].histogram`,
									),
									name: expectString(
										metricRecord["name"],
										`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics[${scopeMetricIndex}].metrics[${metricIndex}].name`,
									),
									sum: parseTelemetryMetricSeries(
										metricRecord["sum"],
										`metricBatch[${index}].resourceMetrics[${resourceMetricIndex}].scopeMetrics[${scopeMetricIndex}].metrics[${metricIndex}].sum`,
									),
								};
							}),
						};
					}),
				};
			}),
		};
	});
});

const readTelemetryTraceBatches: (
	path: string,
) => Effect.Effect<
	Array<ParsedTelemetryTraceBatch>,
	PlatformError.PlatformError | Schema.SchemaError,
	FileSystem.FileSystem
> = Effect.fnUntraced(function* (path: string) {
	return (yield* readNdjson(path)).map((entry, index) => {
		const record = expectRecord(entry, `traceBatch[${index}]`);
		return {
			resourceSpans: expectArray(
				record["resourceSpans"],
				`traceBatch[${index}].resourceSpans`,
			).map((resourceSpan, resourceSpanIndex) => {
				const resourceSpanRecord = expectRecord(
					resourceSpan,
					`traceBatch[${index}].resourceSpans[${resourceSpanIndex}]`,
				);
				return {
					scopeSpans: expectArray(
						resourceSpanRecord["scopeSpans"],
						`traceBatch[${index}].resourceSpans[${resourceSpanIndex}].scopeSpans`,
					).map((scopeSpan, scopeSpanIndex) => {
						const scopeSpanRecord = expectRecord(
							scopeSpan,
							`traceBatch[${index}].resourceSpans[${resourceSpanIndex}].scopeSpans[${scopeSpanIndex}]`,
						);
						return {
							spans: expectArray(
								scopeSpanRecord["spans"],
								`traceBatch[${index}].resourceSpans[${resourceSpanIndex}].scopeSpans[${scopeSpanIndex}].spans`,
							).map((span, spanIndex) => {
								const spanRecord = expectRecord(
									span,
									`traceBatch[${index}].resourceSpans[${resourceSpanIndex}].scopeSpans[${scopeSpanIndex}].spans[${spanIndex}]`,
								);
								return {
									attributes: expectArray(
										spanRecord["attributes"],
										`traceBatch[${index}].resourceSpans[${resourceSpanIndex}].scopeSpans[${scopeSpanIndex}].spans[${spanIndex}].attributes`,
									).map((attribute, attributeIndex) =>
										parseTelemetryAttribute(
											attribute,
											`traceBatch[${index}].resourceSpans[${resourceSpanIndex}].scopeSpans[${scopeSpanIndex}].spans[${spanIndex}].attributes[${attributeIndex}]`,
										),
									),
									name: expectString(
										spanRecord["name"],
										`traceBatch[${index}].resourceSpans[${resourceSpanIndex}].scopeSpans[${scopeSpanIndex}].spans[${spanIndex}].name`,
									),
								};
							}),
						};
					}),
				};
			}),
		};
	});
});

function runWithLayer<Success, Failure, Services>(
	layer: Layer.Layer<Services, never>,
	effect: Effect.Effect<Success, Failure, Services>,
): Effect.Effect<Success, Failure> {
	return Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(layer);
			return yield* Effect.provideServices(effect, services);
		}),
	);
}

function runBunTest<Success, Failure, Services>(
	effect: Effect.Effect<Success, Failure, Services & BunServices.BunServices>,
): Promise<Success> {
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const services = yield* Layer.build(BunServices.layer);
				return yield* Effect.provideServices(effect, services);
			}),
		),
	);
}

describe("GameplayTelemetry", () => {
	test("writes OTEL-shaped trace, log, and metric records with ISO datetimes", async () => {
		await runBunTest(
			Effect.scoped(
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const outputRootDirectory = yield* fs.makeTempDirectoryScoped({
						prefix: "effect2d-telemetry-",
					});

					yield* runWithLayer(
						GameplayTelemetrySession.observabilityLayer({
							gameId: "Effect2d/test-game",
							outputRootDirectory,
						}),
						Effect.gen(function* () {
							yield* Effect.logInfo("Telemetry booted.").pipe(
								Effect.annotateLogs({
									"effect2d.test_case": "writes-otel-records",
								}),
							);
							yield* Effect.sleep("1 millis").pipe(
								Effect.withSpan("GameplayTelemetry.testSpan"),
								Effect.annotateSpans({
									"effect2d.test_case": "writes-otel-records",
								}),
							);
							yield* recordFrameTime(16);
							yield* recordRoomTransition({
								fromRoomId: "room-a",
								toRoomId: "room-b",
							});
							yield* recordSaveWrite("slot-1");
							yield* recordSaveRestore("slot-1");
							yield* setActiveSfxCount(2);
							yield* setCollisionBodyCount(3);
							yield* recordInputEvent("key-down");
						}),
					);

					const descriptor =
						yield* resolveLatestGameplayTelemetrySessionDescriptor(
							"Effect2d/test-game",
							{
								outputRootDirectory,
							},
						);
					assertDefined(descriptor);
					const resolvedDescriptor = descriptor;

					const logRecords = yield* readTelemetryLogBatches(
						resolvedDescriptor.logsFilePath,
					);
					const traceRecords = yield* readTelemetryTraceBatches(
						resolvedDescriptor.tracesFilePath,
					);
					const metricRecords = yield* readTelemetryMetricBatches(
						resolvedDescriptor.metricsFilePath,
					);

					expect(logRecords.length).toBeGreaterThan(0);
					expect(metricRecords.length).toBeGreaterThan(0);
					expect(traceRecords.length).toBeGreaterThan(0);

					const firstLogAttributes =
						logRecords[0]?.resourceLogs[0]?.scopeLogs[0]?.logRecords[0]
							?.attributes;
					assertDefined(firstLogAttributes);
					const exportedTraces = traceRecords.flatMap(
						(traceBatch) =>
							traceBatch.resourceSpans[0]?.scopeSpans[0]?.spans ?? [],
					);
					const firstTrace = exportedTraces[0];
					assertDefined(firstTrace);
					const exportedMetrics = metricRecords.flatMap(
						(metricBatch) =>
							metricBatch.resourceMetrics[0]?.scopeMetrics[0]?.metrics ?? [],
					);
					const firstMetricAttributes =
						exportedMetrics[0]?.gauge?.dataPoints[0]?.attributes ??
						exportedMetrics[0]?.histogram?.dataPoints[0]?.attributes ??
						exportedMetrics[0]?.sum?.dataPoints[0]?.attributes;
					assertDefined(firstMetricAttributes);

					expect(
						firstLogAttributes.some(
							(attribute) =>
								attribute.key === "effect2d.time_iso" &&
								typeof attribute.value.stringValue === "string",
						),
					).toBeTrue();
					expect(
						exportedTraces.some((trace) =>
							trace.attributes.some(
								(attribute) => attribute.key === "effect2d.start_time_iso",
							),
						),
					).toBeTrue();
					expect(
						firstMetricAttributes.some(
							(attribute) => attribute.key === "effect2d.time_iso",
						),
					).toBeTrue();
					expect(firstTrace.name).toContain("GameplayTelemetry");
					expect(
						exportedMetrics.some(
							(metric) => metric.name === "effect2d.frame_time_ms",
						),
					).toBeTrue();
					expect(
						exportedMetrics.some(
							(metric) => metric.name === "effect2d.room_transition_total",
						),
					).toBeTrue();
					expect(
						exportedMetrics.some(
							(metric) => metric.name === "effect2d.save_write_total",
						),
					).toBeTrue();
					expect(
						exportedMetrics.some(
							(metric) => metric.name === "effect2d.save_restore_total",
						),
					).toBeTrue();
					expect(
						exportedMetrics.some(
							(metric) => metric.name === "effect2d.active_sfx_count",
						),
					).toBeTrue();
					expect(
						exportedMetrics.some(
							(metric) => metric.name === "effect2d.collision_body_count",
						),
					).toBeTrue();
					expect(
						exportedMetrics.some(
							(metric) => metric.name === "effect2d.input_event_total",
						),
					).toBeTrue();
				}),
			),
		);
	});

	test("forwards EngineLogger entries into the OTEL log file", async () => {
		await runBunTest(
			Effect.scoped(
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const outputRootDirectory = yield* fs.makeTempDirectoryScoped({
						prefix: "effect2d-telemetry-",
					});

					const layer = Layer.mergeAll(
						EngineLogger.layer,
						GameplayTelemetrySession.observabilityLayer({
							gameId: "Effect2d/test-engine-logger",
							outputRootDirectory,
						}),
					);

					yield* runWithLayer(
						layer,
						Effect.gen(function* () {
							const engineLogger = yield* EngineLogger;
							yield* engineLogger.info("Overlay-visible log entry.", {
								roomId: "debug-room",
							});
						}),
					);

					const descriptor =
						yield* resolveLatestGameplayTelemetrySessionDescriptor(
							"Effect2d/test-engine-logger",
							{
								outputRootDirectory,
							},
						);
					assertDefined(descriptor);
					const resolvedDescriptor = descriptor;

					const logRecords = yield* readTelemetryLogBatches(
						resolvedDescriptor.logsFilePath,
					);
					const exportedLogRecords = logRecords.flatMap(
						(logBatch) =>
							logBatch.resourceLogs[0]?.scopeLogs[0]?.logRecords ?? [],
					);
					const forwardedRecord = exportedLogRecords.find((record) =>
						record.body.stringValue?.includes("Overlay-visible log entry."),
					);
					assertDefined(forwardedRecord);

					expect(forwardedRecord.body.stringValue).toContain(
						"Overlay-visible log entry.",
					);
					expect(
						forwardedRecord.attributes.some(
							(attribute) =>
								attribute.key === "effect2d.engine_logger.sequence" &&
								attribute.value.intValue === 0,
						),
					).toBeTrue();
					expect(
						forwardedRecord.attributes.some(
							(attribute) =>
								attribute.key === "roomId" &&
								attribute.value.stringValue === "debug-room",
						),
					).toBeTrue();

					const commentaryEntry = yield* appendGameplayCommentaryEntry({
						gameId: "Effect2d/test-engine-logger",
						outputRootDirectory,
						text: "The overlay log appeared right after the room loaded.",
					});
					const commentary = yield* readGameplayCommentaryEntries(
						commentaryEntry.commentaryFilePath,
					);
					const firstCommentaryEntry = commentary[0];
					assertDefined(firstCommentaryEntry);

					expect(firstCommentaryEntry.sessionId).toBe(
						resolvedDescriptor.sessionId,
					);
					expect(firstCommentaryEntry.recordedAtIso.length).toBeGreaterThan(0);
					expect(firstCommentaryEntry.text).toContain("overlay log");
				}),
			),
		);
	});
});
