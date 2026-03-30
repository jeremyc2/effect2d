// Avoid type assertions (`as`); use narrowing, checks, or schema parse.

import { Effect } from "effect";

// oxlint-disable-next-line effect2d/no-type-assertion-except-const
const as = "test" as string;
// oxlint-disable-next-line effect2d/no-type-assertion-except-const
const asUnknownAs = "test" as unknown as string;
// "'as const' is allowed"
const asConst = "test" as const;

// oxlint-disable-next-line effect2d/no-try-catch
try {
	// oxlint-disable-next-line effect2d/no-throw
	throw new Error("test");
} catch {}

// oxlint-disable-next-line effect2d/prefer-effect-fn-for-effect-gen
function doBadGenerator() {
	return Effect.gen(function* () {
		yield* Effect.log("test");
		return yield* Effect.succeed("test");
	});
}
// oxlint-disable-next-line effect2d/prefer-effect-fn-for-effect-gen
const doBadGeneratorArrow = () =>
	Effect.gen(function* () {
		yield* Effect.log("test");
		return yield* Effect.succeed("test");
	});

// @effect-diagnostics globalConsole:off Only using console logging here to avoid linting errors. Normally we would not use console, but we use it here to avoid 'no unused variables' Biome errors above.
console.log(asConst);
console.log(as);
console.log(asUnknownAs);
console.log(doBadGenerator);
console.log(doBadGeneratorArrow);
