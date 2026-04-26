import { Context, Effect, Layer, Ref, Schema } from "effect";

/**
 * Structured log severities understood by the engine logger.
 *
 * @public
 *
 * Available levels:
 * - `debug`
 * - `info`
 * - `warn`
 * - `error`
 */
export type LogLevel = "debug" | "error" | "info" | "warn";

/**
 * One structured log record captured by the engine logger.
 *
 * @public
 *
 * `sequence` is monotonically increasing so tooling can preserve authored log
 * order without relying on wall-clock timestamps.
 */
export interface LogEntry {
	readonly context: Readonly<Record<string, string | number | boolean>>;
	readonly level: LogLevel;
	readonly message: string;
	readonly sequence: number;
}

interface EngineLoggerState {
	readonly entries: ReadonlyArray<LogEntry>;
	readonly nextSequence: number;
}

const initialEngineLoggerState: EngineLoggerState = {
	entries: [],
	nextSequence: 0,
};

const LogLevelSchema = Schema.Union([
	Schema.Literal("debug"),
	Schema.Literal("error"),
	Schema.Literal("info"),
	Schema.Literal("warn"),
]);

function forwardToEffectLogger(entry: LogEntry): Effect.Effect<void> {
	const annotations = {
		"effect2d.engine_logger.channel": "debug-overlay",
		"effect2d.engine_logger.sequence": entry.sequence,
		...entry.context,
	};

	switch (entry.level) {
		case "debug":
			return Effect.logDebug(entry.message).pipe(
				Effect.annotateLogs(annotations),
			);
		case "error":
			return Effect.logError(entry.message).pipe(
				Effect.annotateLogs(annotations),
			);
		case "info":
			return Effect.logInfo(entry.message).pipe(
				Effect.annotateLogs(annotations),
			);
		case "warn":
			return Effect.logWarning(entry.message).pipe(
				Effect.annotateLogs(annotations),
			);
	}
}

/** Indicates that a log call received an invalid message payload. @public */
export class InvalidLogMessageError extends Schema.TaggedErrorClass<InvalidLogMessageError>()(
	"InvalidLogMessageError",
	{
		level: LogLevelSchema,
		message: Schema.String,
	},
) {}

/**
 * A small structured log service for gameplay diagnostics and debug tooling.
 *
 * @public
 *
 * `EngineLogger` stores ordered in-memory log entries that other services such
 * as the debug overlay can inspect. Reach for it when you want reproducible,
 * test-friendly diagnostic events without coupling your game code to
 * `console.log`.
 *
 * ```ts
 * const logger = yield* EngineLogger;
 *
 * yield* logger.info("Loaded room", { roomId: "cavern-entrance" });
 * ```
 */
export class EngineLogger extends Context.Service<
	EngineLogger,
	{
		readonly clear: Effect.Effect<void>;
		readonly debug: (
			message: string,
			context?: Readonly<Record<string, string | number | boolean>>,
		) => Effect.Effect<void, InvalidLogMessageError>;
		readonly entries: Effect.Effect<ReadonlyArray<LogEntry>>;
		readonly error: (
			message: string,
			context?: Readonly<Record<string, string | number | boolean>>,
		) => Effect.Effect<void, InvalidLogMessageError>;
		readonly info: (
			message: string,
			context?: Readonly<Record<string, string | number | boolean>>,
		) => Effect.Effect<void, InvalidLogMessageError>;
		readonly warn: (
			message: string,
			context?: Readonly<Record<string, string | number | boolean>>,
		) => Effect.Effect<void, InvalidLogMessageError>;
	}
>()("effect2d/debug/EngineLogger") {
	static readonly layer = Layer.effect(
		EngineLogger,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialEngineLoggerState);

			const append = Effect.fn("EngineLogger.append")(function* (
				level: LogLevel,
				message: string,
				context: Readonly<Record<string, string | number | boolean>> = {},
			) {
				if (message.length === 0) {
					return yield* new InvalidLogMessageError({
						level,
						message,
					});
				}

				const entry = yield* Ref.modify(stateRef, (state) => {
					const nextEntry = {
						context,
						level,
						message,
						sequence: state.nextSequence,
					} satisfies LogEntry;

					return [
						nextEntry,
						{
							entries: [...state.entries, nextEntry],
							nextSequence: state.nextSequence + 1,
						} satisfies EngineLoggerState,
					] as const;
				});

				yield* forwardToEffectLogger(entry);
			});

			return EngineLogger.of({
				clear: Ref.set(stateRef, initialEngineLoggerState),
				debug: (message, context) => append("debug", message, context),
				entries: Ref.get(stateRef).pipe(Effect.map((state) => state.entries)),
				error: (message, context) => append("error", message, context),
				info: (message, context) => append("info", message, context),
				warn: (message, context) => append("warn", message, context),
			});
		}),
	);
}
