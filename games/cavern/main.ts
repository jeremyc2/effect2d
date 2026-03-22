import { Effect, Layer } from "effect";
import {
	CavernPlayableLive,
	playableCavernProgram,
} from "./game/CavernGame.ts";

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(CavernPlayableLive);
			return yield* Effect.provideServices(playableCavernProgram, services);
		}),
	),
);
