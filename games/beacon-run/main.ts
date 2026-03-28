import { Effect, Layer } from "effect";
import { GameplayTelemetrySession } from "../../src/index.ts";
import {
	BeaconRunPlayableLive,
	beaconRunConfig,
	playableBeaconRunProgram,
} from "./game/BeaconRunGame.ts";

const beaconRunTelemetryLayer = GameplayTelemetrySession.observabilityLayer({
	gameId: beaconRunConfig.gameId,
	resourceAttributes: {
		"effect2d.sample_game": "beacon-run",
	},
});

const beaconRunMainLayer = Layer.mergeAll(
	BeaconRunPlayableLive,
	beaconRunTelemetryLayer,
);

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(beaconRunMainLayer);
			return yield* Effect.provideServices(playableBeaconRunProgram, services);
		}),
	).pipe(
		Effect.annotateLogs({
			"effect2d.game.id": beaconRunConfig.gameId,
			"effect2d.session.kind": "playable",
		}),
		Effect.annotateSpans({
			"effect2d.game.id": beaconRunConfig.gameId,
			"effect2d.session.kind": "playable",
		}),
		Effect.withSpan("BeaconRun.main"),
	),
);
