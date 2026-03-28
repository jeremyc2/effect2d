import { Effect, Layer } from "effect";
import { GameplayTelemetrySession } from "../../src/index.ts";
import {
	CavernPlayableLive,
	cavernConfig,
	playableCavernProgram,
} from "./game/CavernGame.ts";

const cavernTelemetryLayer = GameplayTelemetrySession.observabilityLayer({
	gameId: cavernConfig.gameId,
	resourceAttributes: {
		"effect2d.sample_game": "cavern",
	},
});

const cavernMainLayer = Layer.mergeAll(
	CavernPlayableLive,
	cavernTelemetryLayer,
);

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(cavernMainLayer);
			return yield* Effect.provideServices(playableCavernProgram, services);
		}),
	).pipe(
		Effect.annotateLogs({
			"effect2d.game.id": cavernConfig.gameId,
			"effect2d.session.kind": "playable",
		}),
		Effect.annotateSpans({
			"effect2d.game.id": cavernConfig.gameId,
			"effect2d.session.kind": "playable",
		}),
		Effect.withSpan("Cavern.main"),
	),
);
