import { describe, expect, test } from "bun:test";
import { Data, Effect, Schema } from "effect";

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
			throw "boom";
		};
		expect(throwing).toThrow();
	});
	test("Oxlint forbids try/catch (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/no-try-catch
		try {
		} catch {}
	});
	test("Oxlint forbids `.catch()` chains (if we hadn't used oxlint-disable-next-line)", () => {
		const wrapper = {
			catch: () => "recovered",
		};
		// oxlint-disable-next-line effect2d/no-try-catch
		expect(wrapper.catch()).toBe("recovered");
	});
	test("Oxlint forbids `.finally()` chains (if we hadn't used oxlint-disable-next-line)", () => {
		const wrapper = {
			finally: () => "done",
		};
		// oxlint-disable-next-line effect2d/no-try-catch
		expect(wrapper.finally()).toBe("done");
	});
	test("Oxlint forbids `.then()` chains (if we hadn't used oxlint-disable-next-line)", () => {
		const effectPromise = Effect.runPromise(Effect.succeed("done"));
		// oxlint-disable-next-line effect2d/no-then-chain
		expect(effectPromise.then((value) => value)).resolves.toBe("done");
	});
	test("Oxlint forbids the built-in Promise constructor (if we hadn't used oxlint-disable-next-line)", () => {
		// @effect-diagnostics newPromise:off -- Intentional lint fixture for the forbidden Promise constructor.
		// oxlint-disable-next-line effect2d/no-promise-global
		const promise = new Promise<string>((resolve) => resolve("ok"));
		// @effect-diagnostics newPromise:error -- Re-enable immediately after the focused lint fixture.
		expect(typeof promise.then).toBe("function");
	});
	test("Oxlint forbids static Promise methods (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/no-promise-global
		const promise = Promise.resolve("ok");
		expect(typeof promise.then).toBe("function");
	});
	test("Oxlint forbids the built-in Error constructor (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/no-error-class
		const error = new Error("boom");
		expect(error.message).toBe("boom");
	});
	test("Oxlint forbids calling the built-in Error constructor without new (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/no-error-class
		const error = Error("boom");
		expect(error.message).toBe("boom");
	});
	test("Oxlint forbids Data.TaggedError (if we hadn't used oxlint-disable-next-line)", () => {
		// oxlint-disable-next-line effect2d/prefer-schema-tagged-error-class
		class BadTaggedError extends Data.TaggedError("BadTaggedError")<
			Record<never, never>
		> {}
		expect(BadTaggedError).toBeInstanceOf(Function);
	});
	test("Oxlint allows Schema.TaggedErrorClass", () => {
		class GoodTaggedError extends Schema.TaggedErrorClass<GoodTaggedError>()(
			"GoodTaggedError",
			{},
		) {}
		expect(GoodTaggedError).toBeInstanceOf(Function);
	});
	test("Oxlint forbids direct `._tag` reads (if we hadn't used oxlint-disable-next-line)", () => {
		const value = { _tag: "Failure" };
		// oxlint-disable-next-line effect2d/no-tag-property-access
		expect(value._tag).toBe("Failure");
	});
	test('Oxlint forbids direct `["_tag"]` reads (if we hadn\'t used oxlint-disable-next-line)', () => {
		const value = { _tag: "Failure" };
		// oxlint-disable-next-line effect2d/no-tag-property-access
		expect(value["_tag"]).toBe("Failure");
	});
	test("Oxlint allows `Effect.catch(...)`", () => {
		const recovered = Effect.catch(Effect.fail("boom"), () =>
			Effect.succeed("ok"),
		);
		expect(recovered).toBeDefined();
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
		const doBadGeneratorArrow = () =>
			Effect.gen(function* () {
				yield* Effect.log("test");
				return yield* Effect.succeed("test");
			});
		expect(doBadGeneratorArrow).toBeInstanceOf(Function);
	});
});
