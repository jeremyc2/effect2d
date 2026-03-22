import { Effect } from "effect";
import { StarterGameLive, starterProgram } from "./game/StarterGame.ts";

await Effect.runPromise(starterProgram.pipe(Effect.provide(StarterGameLive)));
