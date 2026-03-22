import { Effect, Layer } from "effect";
import {
	BeaconRunPlayableLive,
	playableBeaconRunProgram,
} from "./game/BeaconRunGame.ts";

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(BeaconRunPlayableLive);
			return yield* Effect.provideServices(playableBeaconRunProgram, services);
		}),
	),
);
