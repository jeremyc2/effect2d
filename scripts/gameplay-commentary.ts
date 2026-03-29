import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer, Option, Queue, type Scope, Terminal } from "effect";
import type { Done } from "effect/Cause";
import { Argument, Command, Flag } from "effect/unstable/cli";
import packageJson from "../package.json" with { type: "json" };
import {
	appendGameplayCommentaryEntry,
	createGameplayTelemetrySessionDescriptor,
	resolveLatestGameplayTelemetrySessionDescriptor,
} from "../src/debug/GameplayTelemetry.ts";

const liveCommentaryPrompt = "> ";
const ansiEscape = "\u001b[";

function countRenderedRows(text: string, columns: number): number {
	if (columns <= 0) {
		return 1;
	}

	return Math.max(1, 1 + Math.floor(Math.max(text.length - 1, 0) / columns));
}

function eraseTerminalRows(rows: number): string {
	let output = "";
	for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
		output += `${ansiEscape}2K`;
		if (rowIndex < rows - 1) {
			output += `${ansiEscape}1A`;
		}
	}
	return `${output}${ansiEscape}G`;
}

const displayLine = Effect.fnUntraced(function* (text: string) {
	const terminal = yield* Terminal.Terminal;
	yield* terminal.display(`${text}\n`).pipe(Effect.orDie);
});

const redrawLiveCommentaryInput = Effect.fnUntraced(function* (
	text: string,
	previousPromptText: string,
) {
	const terminal = yield* Terminal.Terminal;
	if (previousPromptText.length > 0) {
		const columns = yield* terminal.columns;
		yield* terminal
			.display(
				eraseTerminalRows(countRenderedRows(previousPromptText, columns)),
			)
			.pipe(Effect.orDie);
	}

	const promptText = `${liveCommentaryPrompt}${text}`;
	yield* terminal.display(promptText).pipe(Effect.orDie);
	return promptText;
});

const readLiveCommentaryLine: (
	inputQueue: Queue.Dequeue<Terminal.UserInput, Done>,
) => Effect.Effect<
	string,
	Terminal.QuitError,
	Terminal.Terminal | Scope.Scope
> = Effect.fnUntraced(function* (
	inputQueue: Queue.Dequeue<Terminal.UserInput, Done>,
) {
	const terminal = yield* Terminal.Terminal;
	let currentLine = "";
	let renderedPromptText = "";

	renderedPromptText = yield* redrawLiveCommentaryInput(
		currentLine,
		renderedPromptText,
	);

	while (true) {
		const userInput = yield* Queue.take(inputQueue).pipe(
			Effect.mapError(() => new Terminal.QuitError({})),
		);

		if (
			userInput.key.ctrl &&
			(userInput.key.name === "c" || userInput.key.name === "d")
		) {
			return yield* new Terminal.QuitError({});
		}

		if (userInput.key.name === "enter" || userInput.key.name === "return") {
			yield* terminal.display("\n").pipe(Effect.orDie);
			return currentLine;
		}

		if (userInput.key.name === "backspace" || userInput.key.name === "delete") {
			currentLine =
				currentLine.length === 0 ? currentLine : currentLine.slice(0, -1);
			renderedPromptText = yield* redrawLiveCommentaryInput(
				currentLine,
				renderedPromptText,
			);
			continue;
		}

		currentLine = Option.match(userInput.input, {
			onNone: () => currentLine,
			onSome: (input) => `${currentLine}${input}`,
		});
		renderedPromptText = yield* redrawLiveCommentaryInput(
			currentLine,
			renderedPromptText,
		);
	}
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

const printSessionDetails = Effect.fnUntraced(function* (descriptor: {
	readonly commentaryFilePath: string;
	readonly logsFilePath: string;
	readonly sessionDirectory: string;
	readonly tracesFilePath: string;
}) {
	yield* displayLine(`Session directory: ${descriptor.sessionDirectory}`);
	yield* displayLine(`Commentary file: ${descriptor.commentaryFilePath}`);
	yield* displayLine(`Logs file: ${descriptor.logsFilePath}`);
	yield* displayLine(`Traces file: ${descriptor.tracesFilePath}`);
});

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
		const terminal = yield* Terminal.Terminal;
		const requestedSessionDirectory = sessionDirectoryValue(config.sessionDir);
		const descriptor =
			requestedSessionDirectory === undefined
				? ((yield* resolveLatestGameplayTelemetrySessionDescriptor(
						config.game,
					)) ??
					(yield* createGameplayTelemetrySessionDescriptor({
						gameId: config.game,
					})))
				: yield* createGameplayTelemetrySessionDescriptor({
						gameId: config.game,
						sessionDirectory: requestedSessionDirectory,
					});
		yield* printSessionDetails(descriptor);
		yield* displayLine(
			"Type commentary and press Enter. Press Ctrl+C to stop.",
		);

		const inputQueue = yield* terminal.readInput;
		const sessionDirectory = descriptor.sessionDirectory;

		yield* Effect.forever(
			readLiveCommentaryLine(inputQueue).pipe(
				Effect.map((line) => line.trim()),
				Effect.flatMap((text) =>
					text.length === 0
						? Effect.void
						: appendGameplayCommentaryEntry({
								gameId: config.game,
								sessionDirectory,
								text,
							}).pipe(Effect.asVoid),
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
	Command.withSubcommands([appendCommand, liveCommand]),
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
