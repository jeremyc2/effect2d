import { Schema } from "effect";

/** Indicates that a scene id was requested but not registered. @public */
export class SceneNotFoundError extends Schema.TaggedErrorClass<SceneNotFoundError>()(
	"SceneNotFoundError",
	{
		sceneId: Schema.String,
	},
) {}

/** Indicates that a scene-stack operation required an active scene when none existed. @public */
export class SceneStackEmptyError extends Schema.TaggedErrorClass<SceneStackEmptyError>()(
	"SceneStackEmptyError",
	{
		reason: Schema.String,
	},
) {}

/** Indicates that code tried to pop an overlay when the overlay stack was empty. @public */
export class OverlayStackUnderflowError extends Schema.TaggedErrorClass<OverlayStackUnderflowError>()(
	"OverlayStackUnderflowError",
	{
		reason: Schema.String,
	},
) {}
