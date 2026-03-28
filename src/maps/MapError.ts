import { Schema } from "effect";

/** Indicates that authored room content failed validation. @public */
export class MapValidationError extends Schema.TaggedErrorClass<MapValidationError>()(
	"MapValidationError",
	{
		reason: Schema.String,
		roomId: Schema.String,
	},
) {}

/** Indicates that room content could not be serialized or deserialized. @public */
export class MapSerializationError extends Schema.TaggedErrorClass<MapSerializationError>()(
	"MapSerializationError",
	{
		details: Schema.String,
		operation: Schema.Union([
			Schema.Literal("deserialize"),
			Schema.Literal("serialize"),
		]),
	},
) {}
