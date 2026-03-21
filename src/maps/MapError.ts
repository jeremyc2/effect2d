import { Schema } from "effect";

export class MapValidationError extends Schema.TaggedErrorClass<MapValidationError>()(
	"MapValidationError",
	{
		reason: Schema.String,
		roomId: Schema.String,
	},
) {}
