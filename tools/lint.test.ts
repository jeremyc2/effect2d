import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

describe("lint fixtures", () => {
	test("Oxlint forbids type assertions except `as const` (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/no-type-assertion-except-const
		const as = "test" as string;
		expect(as).toBe("test");
	});
	test("Oxlint forbids `as unknown as` type assertions (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/no-type-assertion-except-const
		const asUnknownAs = "test" as unknown as string;
		expect(asUnknownAs).toBe("test");
	});
	test("Oxlint allows `as const` type assertions", () => {
		const asConst = "test" as const;
		expect(asConst).toBe("test");
	});
	test("Oxlint forbids throw (if we hadn't used oxlint-disable-next-line)", () => {
		const throwing = () => {
			// oxlint-disable-next-line effect2d/no-throw
			throw new Error();
		};
		expect(throwing).toThrow();
	});
	test("Oxlint forbids try/catch (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/no-try-catch
		try {
		} catch {}
	});
	test("Oxlint forbids functions that return effect.gen (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/prefer-effect-fn-for-effect-gen
		function doBadGenerator() {
			return Effect.gen(function* () {
				yield* Effect.log("test");
				return yield* Effect.succeed("test");
			});
		}
		expect(doBadGenerator).toBeInstanceOf(Function);
	});
	test("Oxlint forbids arrow functions that return effect.gen (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/prefer-effect-fn-for-effect-gen
		const doBadGeneratorArrow = () => {
			return Effect.gen(function* () {
				yield* Effect.log("test");
				return yield* Effect.succeed("test");
			});
		};
		expect(doBadGeneratorArrow).toBeInstanceOf(Function);
	});
});
