import { Schema } from "effect";

export class SceneNotFoundError extends Schema.TaggedErrorClass<SceneNotFoundError>()(
	"SceneNotFoundError",
	{
		sceneId: Schema.String,
	},
) {}

export class SceneStackEmptyError extends Schema.TaggedErrorClass<SceneStackEmptyError>()(
	"SceneStackEmptyError",
	{
		reason: Schema.String,
	},
) {}

export class OverlayStackUnderflowError extends Schema.TaggedErrorClass<OverlayStackUnderflowError>()(
	"OverlayStackUnderflowError",
	{
		reason: Schema.String,
	},
) {}
