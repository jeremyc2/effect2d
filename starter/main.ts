import { Effect, Layer } from "effect";
import { GameplayTelemetrySession } from "../src/index.ts";
import {
	StarterGameLive,
	starterConfig,
	starterProgram,
} from "./game/StarterGame.ts";

const starterTelemetryLayer = GameplayTelemetrySession.observabilityLayer({
	gameId: starterConfig.gameId,
	resourceAttributes: {
		"effect2d.sample_game": "starter",
	},
});

const starterMainLayer = Layer.mergeAll(StarterGameLive, starterTelemetryLayer);

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(starterMainLayer);
			return yield* Effect.provideServices(starterProgram, services);
		}),
	).pipe(
		Effect.annotateLogs({
			"effect2d.game.id": starterConfig.gameId,
			"effect2d.session.kind": "starter",
		}),
		Effect.annotateSpans({
			"effect2d.game.id": starterConfig.gameId,
			"effect2d.session.kind": "starter",
		}),
		Effect.withSpan("Starter.main"),
	),
);
