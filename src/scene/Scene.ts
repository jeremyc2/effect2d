import type { Effect } from "effect";

export type SceneId = string;

export type SceneLayer = "overlay" | "primary";

export interface SceneLifecycle {
	readonly enter: () => Effect.Effect<void>;
	readonly update: () => Effect.Effect<void>;
	readonly draw: () => Effect.Effect<void>;
	readonly exit: () => Effect.Effect<void>;
	readonly handleInput?: () => Effect.Effect<void>;
}

export interface SceneDefinition {
	readonly id: SceneId;
	readonly lifecycle: SceneLifecycle;
}

export interface SceneStackEntry {
	readonly layer: SceneLayer;
	readonly scene: SceneDefinition;
}

export interface SceneStackSnapshot {
	readonly activeSceneId: SceneId;
	readonly entries: ReadonlyArray<{
		readonly layer: SceneLayer;
		readonly sceneId: SceneId;
	}>;
}
