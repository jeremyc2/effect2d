import type { Effect, Scope } from "effect";

/**
 * Identifies a scene inside a game.
 *
 * @public
 *
 * Scene ids are usually short authored names like `"title"`, `"overworld"`,
 * or `"pause"`.
 */
export type SceneId = string;

/**
 * Distinguishes the primary gameplay scene from temporary overlay scenes such
 * as pause menus, inventory sheets, or modal dialogue stacks.
 *
 * @public
 *
 * Available levels:
 * - `primary`
 * - `overlay`
 */
export type SceneStackLevel = "overlay" | "primary";

/**
 * The lifecycle hooks a scene instance can contribute to the runtime.
 *
 * @public
 *
 * A scene is responsible for its own setup, update, drawing, optional input
 * handling, and teardown. Each hook runs in a scene-local `Scope`, which makes
 * it natural to start background effects that should be cleaned up when the
 * scene exits.
 */
export interface SceneLifecycle {
	readonly enter: () => Effect.Effect<void, never, Scope.Scope>;
	readonly update: () => Effect.Effect<void, never, Scope.Scope>;
	readonly draw: () => Effect.Effect<void, never, Scope.Scope>;
	readonly exit: () => Effect.Effect<void, never, Scope.Scope>;
	readonly handleInput?: () => Effect.Effect<void, never, Scope.Scope>;
}

/**
 * Declares how a scene is identified and instantiated.
 *
 * @public
 *
 * In application code you usually author a `SceneDefinition` as a constant and
 * provide it through {@link SceneLookup.layer}.
 *
 * ```ts
 * const titleScene: SceneDefinition = {
 *   id: "title",
 *   instantiate: Effect.succeed({
 *     enter: Effect.void,
 *     update: Effect.void,
 *     draw: Effect.void,
 *     exit: Effect.void,
 *   }),
 * };
 * ```
 */
export interface SceneDefinition {
	readonly id: SceneId;
	readonly instantiate: Effect.Effect<SceneLifecycle>;
}

/**
 * Represents a live instantiated scene managed by the engine.
 *
 * @public
 *
 * This type is mostly useful in tests and scene-management internals.
 */
export interface SceneInstance {
	readonly definition: SceneDefinition;
	readonly lifecycle: SceneLifecycle;
	readonly scope: Scope.Closeable;
}

/**
 * A single entry in the runtime scene stack.
 *
 * @public
 *
 * Overlay entries sit above the active primary scene.
 */
export interface SceneStackEntry {
	readonly instance: SceneInstance;
	readonly level: SceneStackLevel;
}

/**
 * A serializable view of the current scene stack.
 *
 * @public
 *
 * This snapshot is useful for diagnostics and tests that want to assert stack
 * transitions without depending on scene internals.
 */
export interface SceneStackSnapshot {
	readonly activeSceneId: SceneId;
	readonly entries: ReadonlyArray<{
		readonly level: SceneStackLevel;
		readonly sceneId: SceneId;
	}>;
}
