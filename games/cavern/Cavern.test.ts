import { describe, expect, it } from "bun:test";
import { Effect, Layer } from "effect";
import { Engine } from "../../src/index.ts";
import {
	CavernLive,
	cavernBootstrap,
	cavernProgram,
} from "./game/CavernGame.ts";

describe("cavern", () => {
	it("bootstraps and launches through its own game entry point", async () => {
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const services = yield* Layer.build(CavernLive);
					yield* Effect.provideServices(cavernProgram, services);
				}),
			),
		);
	});

	it("loads the Cavern menu slice and engine config", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Layer.build(CavernLive).pipe(
					Effect.flatMap((services) =>
						Effect.provideServices(
							Effect.gen(function* () {
								const engine = yield* Engine;
								yield* cavernBootstrap;
								return engine.config;
							}),
							services,
						),
					),
				),
			),
		);

		expect(result.gameId).toBe("effect2d/cavern");
		expect(result.startScene).toBe("main-menu");
	});
});
