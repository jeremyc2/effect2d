import type { Effect } from "effect";

export interface SceneLifecycle {
	readonly enter: Effect.Effect<void>;
	readonly update: Effect.Effect<void>;
	readonly draw: Effect.Effect<void>;
	readonly exit: Effect.Effect<void>;
}

export interface SceneDefinition {
	readonly id: string;
	readonly lifecycle: SceneLifecycle;
}
