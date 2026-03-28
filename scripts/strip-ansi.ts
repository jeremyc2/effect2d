import { stripANSI } from "bun";

// Read from standard input as a stream
for await (const chunk of Bun.stdin.stream()) {
	const text = new TextDecoder().decode(chunk);
	// Strip ANSI codes and write directly to standard output
	process.stdout.write(stripANSI(text));
}
