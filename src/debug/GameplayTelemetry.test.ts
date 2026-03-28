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

function expectDefined<T>(value: T | null | undefined): T {
	expect(value).toBeDefined();
	return value as T;
}

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
					const resolvedDescriptor = expectDefined(descriptor);

					const logRecords = (yield* readNdjson(
						resolvedDescriptor.logsFilePath,
					)) as Array<{
						readonly resourceLogs: ReadonlyArray<{
							readonly scopeLogs: ReadonlyArray<{
								readonly logRecords: ReadonlyArray<{
									readonly attributes: ReadonlyArray<{
										readonly key: string;
										readonly value: {
											readonly stringValue?: string;
										};
									}>;
								}>;
							}>;
						}>;
					}>;
					const traceRecords = (yield* readNdjson(
						resolvedDescriptor.tracesFilePath,
					)) as Array<{
						readonly resourceSpans: ReadonlyArray<{
							readonly scopeSpans: ReadonlyArray<{
								readonly spans: ReadonlyArray<{
									readonly attributes: ReadonlyArray<{
										readonly key: string;
									}>;
									readonly name: string;
								}>;
							}>;
						}>;
					}>;
					const metricRecords = (yield* readNdjson(
						resolvedDescriptor.metricsFilePath,
					)) as Array<{
						readonly resourceMetrics: ReadonlyArray<{
							readonly scopeMetrics: ReadonlyArray<{
								readonly metrics: ReadonlyArray<{
									readonly gauge?: {
										readonly dataPoints: ReadonlyArray<{
											readonly attributes: ReadonlyArray<{
												readonly key: string;
											}>;
										}>;
									};
									readonly histogram?: {
										readonly dataPoints: ReadonlyArray<{
											readonly attributes: ReadonlyArray<{
												readonly key: string;
											}>;
										}>;
									};
									readonly name: string;
									readonly sum?: {
										readonly dataPoints: ReadonlyArray<{
											readonly attributes: ReadonlyArray<{
												readonly key: string;
											}>;
										}>;
									};
								}>;
							}>;
						}>;
					}>;

					expect(logRecords.length).toBeGreaterThan(0);
					expect(metricRecords.length).toBeGreaterThan(0);
					expect(traceRecords.length).toBeGreaterThan(0);

					const firstLogAttributes = expectDefined(
						logRecords[0]?.resourceLogs[0]?.scopeLogs[0]?.logRecords[0]
							?.attributes,
					);
					const firstTrace = expectDefined(
						traceRecords[0]?.resourceSpans[0]?.scopeSpans[0]?.spans[0],
					);
					const exportedMetrics = metricRecords.flatMap(
						(metricBatch) =>
							metricBatch.resourceMetrics[0]?.scopeMetrics[0]?.metrics ?? [],
					);
					const firstMetricAttributes = expectDefined(
						exportedMetrics[0]?.gauge?.dataPoints[0]?.attributes ??
							exportedMetrics[0]?.histogram?.dataPoints[0]?.attributes ??
							exportedMetrics[0]?.sum?.dataPoints[0]?.attributes,
					);

					expect(
						firstLogAttributes.some(
							(attribute) =>
								attribute.key === "effect2d.time_iso" &&
								typeof attribute.value.stringValue === "string",
						),
					).toBeTrue();
					expect(
						firstTrace.attributes.some(
							(attribute) => attribute.key === "effect2d.start_time_iso",
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
					const resolvedDescriptor = expectDefined(descriptor);

					const logRecords = (yield* readNdjson(
						resolvedDescriptor.logsFilePath,
					)) as Array<{
						readonly resourceLogs: ReadonlyArray<{
							readonly scopeLogs: ReadonlyArray<{
								readonly logRecords: ReadonlyArray<{
									readonly attributes: ReadonlyArray<{
										readonly key: string;
										readonly value: {
											readonly intValue?: number;
											readonly stringValue?: string;
										};
									}>;
									readonly body: {
										readonly stringValue?: string;
									};
								}>;
							}>;
						}>;
					}>;
					const forwardedRecord = expectDefined(
						logRecords[0]?.resourceLogs[0]?.scopeLogs[0]?.logRecords[0],
					);

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
					const commentary = (yield* readNdjson(
						commentaryEntry.commentaryFilePath,
					)) as Array<{
						readonly recordedAtIso: string;
						readonly sessionId: string;
						readonly text: string;
					}>;
					const firstCommentaryEntry = expectDefined(commentary[0]);

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
