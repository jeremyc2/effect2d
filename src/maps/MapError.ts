import { Schema } from "effect";

export class MapValidationError extends Schema.TaggedErrorClass<MapValidationError>()(
	"MapValidationError",
	{
		reason: Schema.String,
		roomId: Schema.String,
	},
) {}

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
