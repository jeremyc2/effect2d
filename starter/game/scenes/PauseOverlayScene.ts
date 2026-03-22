import { Effect } from "effect";
import type { SceneDefinition } from "../../../src/scene/Scene.ts";

export const PauseOverlayScene: SceneDefinition = {
	id: "pause-overlay",
	instantiate: Effect.succeed({
		draw: () => Effect.void,
		enter: () => Effect.void,
		exit: () => Effect.void,
		handleInput: () => Effect.void,
		update: () => Effect.void,
	}),
};
