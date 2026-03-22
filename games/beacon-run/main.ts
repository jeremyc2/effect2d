import { Effect } from "effect";
import { BeaconRunLive, beaconRunProgram } from "./game/BeaconRunGame.ts";

await Effect.runPromise(beaconRunProgram.pipe(Effect.provide(BeaconRunLive)));
