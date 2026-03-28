import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer, Option, Terminal } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import packageJson from "../package.json" with { type: "json" };
import {
	appendGameplayCommentaryEntry,
	createGameplayTelemetrySessionDescriptor,
	resolveLatestGameplayTelemetrySessionDescriptor,
} from "../src/debug/GameplayTelemetry.ts";

const displayLine = Effect.fnUntraced(function* (text: string) {
	const terminal = yield* Terminal.Terminal;
	yield* terminal.display(`${text}\n`).pipe(Effect.orDie);
});

const gameFlag = Flag.string("game").pipe(
	Flag.withAlias("g"),
	Flag.withDescription("Game identifier, for example Effect2d/beacon-run."),
);

const sessionDirectoryFlag = Flag.directory("session-dir").pipe(
	Flag.optional,
	Flag.withDescription(
		"Optional telemetry session directory to reuse or create.",
	),
);

function sessionDirectoryValue(
	sessionDirectory: Option.Option<string>,
): string | undefined {
	return Option.getOrUndefined(sessionDirectory);
}

function resolveDescriptor(options: {
	readonly game: string;
	readonly sessionDir: Option.Option<string>;
}) {
	const sessionDirectory = sessionDirectoryValue(options.sessionDir);
	return sessionDirectory === undefined
		? resolveLatestGameplayTelemetrySessionDescriptor(options.game)
		: createGameplayTelemetrySessionDescriptor({
				gameId: options.game,
				sessionDirectory,
			});
}

const printSessionDetails = Effect.fnUntraced(function* (options: {
	readonly game: string;
	readonly sessionDir: Option.Option<string>;
}) {
	const descriptor = yield* resolveDescriptor(options);

	if (descriptor === null) {
		yield* displayLine(
			`No gameplay telemetry session found for ${options.game}.`,
		);
		return;
	}

	yield* displayLine(`Session directory: ${descriptor.sessionDirectory}`);
	yield* displayLine(`Commentary file: ${descriptor.commentaryFilePath}`);
	yield* displayLine(`Logs file: ${descriptor.logsFilePath}`);
	yield* displayLine(`Traces file: ${descriptor.tracesFilePath}`);
});

const startCommand = Command.make(
	"start",
	{
		game: gameFlag,
		sessionDir: sessionDirectoryFlag,
	},
	Effect.fnUntraced(function* (config) {
		const descriptor = yield* createGameplayTelemetrySessionDescriptor({
			gameId: config.game,
			sessionDirectory: sessionDirectoryValue(config.sessionDir),
		});
		yield* displayLine(`Session directory: ${descriptor.sessionDirectory}`);
		yield* displayLine(`Commentary file: ${descriptor.commentaryFilePath}`);
		yield* displayLine(`Logs file: ${descriptor.logsFilePath}`);
		yield* displayLine(`Traces file: ${descriptor.tracesFilePath}`);
	}),
).pipe(
	Command.withDescription(
		"Create or reuse a telemetry session directory for live gameplay notes.",
	),
);

const commentaryArgument = Argument.string("commentary").pipe(
	Argument.variadic({ min: 1 }),
	Argument.map((parts) => parts.join(" ")),
	Argument.withDescription("Gameplay commentary text to append."),
);

const appendCommand = Command.make(
	"append",
	{
		game: gameFlag,
		sessionDir: sessionDirectoryFlag,
		commentary: commentaryArgument,
	},
	Effect.fnUntraced(function* (config) {
		const entry = yield* appendGameplayCommentaryEntry({
			gameId: config.game,
			sessionDirectory: sessionDirectoryValue(config.sessionDir),
			text: config.commentary,
		});
		yield* displayLine(`[${entry.recordedAtIso}] ${entry.text}`);
		yield* displayLine(`Commentary file: ${entry.commentaryFilePath}`);
	}),
).pipe(
	Command.withDescription(
		"Append one timestamped gameplay commentary entry to the active session.",
	),
);

const liveCommand = Command.make(
	"live",
	{
		game: gameFlag,
		sessionDir: sessionDirectoryFlag,
	},
	Effect.fnUntraced(function* (config) {
		yield* printSessionDetails({
			game: config.game,
			sessionDir: config.sessionDir,
		});
		yield* displayLine(
			"Type commentary and press Enter. Press Ctrl+C to stop.",
		);

		const terminal = yield* Terminal.Terminal;
		const sessionDirectory = sessionDirectoryValue(config.sessionDir);

		yield* Effect.forever(
			terminal.readLine.pipe(
				Effect.map((line) => line.trim()),
				Effect.flatMap((text) =>
					text.length === 0
						? Effect.void
						: appendGameplayCommentaryEntry({
								gameId: config.game,
								sessionDirectory,
								text,
							}).pipe(
								Effect.flatMap((entry) =>
									displayLine(`[${entry.recordedAtIso}] ${entry.text}`),
								),
							),
				),
			),
		).pipe(
			Effect.catchIf(
				(error): error is Terminal.QuitError => Terminal.isQuitError(error),
				() => Effect.void,
			),
		);
	}),
).pipe(
	Command.withDescription(
		"Append timestamped commentary interactively while you play.",
	),
);

const commentaryCommand = Command.make("commentary").pipe(
	Command.withDescription("Manage timestamped gameplay commentary sessions."),
	Command.withSubcommands([startCommand, appendCommand, liveCommand]),
);

const program = Effect.scoped(
	Effect.gen(function* () {
		const services = yield* Layer.build(BunServices.layer);
		return yield* Effect.provideServices(
			Command.run(commentaryCommand, {
				version: packageJson.version,
			}),
			services,
		);
	}),
);

BunRuntime.runMain(program);
