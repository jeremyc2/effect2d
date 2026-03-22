import { Effect } from "effect";
import type { SceneDefinition } from "../../../../src/scene/Scene.ts";

export const FieldScene: SceneDefinition = {
	id: "field",
	instantiate: Effect.succeed({
		draw: () => Effect.void,
		enter: () => Effect.void,
		exit: () => Effect.void,
		handleInput: () => Effect.void,
		update: () => Effect.void,
	}),
};
