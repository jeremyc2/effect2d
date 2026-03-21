import { Schema } from "effect";

export class EngineLaunchError extends Schema.TaggedErrorClass<EngineLaunchError>()(
	"EngineLaunchError",
	{
		module: Schema.String,
		reason: Schema.String,
	},
) {}

export class EngineConfigurationError extends Schema.TaggedErrorClass<EngineConfigurationError>()(
	"EngineConfigurationError",
	{
		field: Schema.String,
		reason: Schema.String,
	},
) {}
