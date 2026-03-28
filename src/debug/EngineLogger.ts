import { Effect, Layer, Ref, Schema, ServiceMap } from "effect";

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
export class EngineLogger extends ServiceMap.Service<
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

				yield* Ref.update(stateRef, (state) => ({
					entries: [
						...state.entries,
						{
							context,
							level,
							message,
							sequence: state.nextSequence,
						},
					],
					nextSequence: state.nextSequence + 1,
				}));
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
