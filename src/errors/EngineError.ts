import { Schema } from "effect";

/** Indicates that engine startup failed while initializing a runtime module. @public */
export class EngineLaunchError extends Schema.TaggedErrorClass<EngineLaunchError>()(
	"EngineLaunchError",
	{
		module: Schema.String,
		reason: Schema.String,
	},
) {}

/** Indicates that engine configuration was invalid before launch. @public */
export class EngineConfigurationError extends Schema.TaggedErrorClass<EngineConfigurationError>()(
	"EngineConfigurationError",
	{
		field: Schema.String,
		reason: Schema.String,
	},
) {}
