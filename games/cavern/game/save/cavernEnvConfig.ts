import { Config, Schema } from "effect";

/**
 * Builds an optional string config whose env key is `segments.join("_")`
 * (Effect {@link ConfigProvider.fromEnv} trie).
 */
const optionalStringVar = (segments: readonly string[]) =>
	Config.schema(Schema.String, [...segments]).pipe(Config.option);

/**
 * `EFFECT2D_CAVERN_SAVE_DIR` — optional base directory for Cavern disk saves.
 *
 * @public
 */
export const cavernSaveDir = optionalStringVar([
	"EFFECT2D",
	"CAVERN",
	"SAVE",
	"DIR",
]);
