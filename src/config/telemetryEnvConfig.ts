import { Config, Schema } from "effect";

/**
 * Builds an optional string config whose env key is `segments.join("_")`
 * (Effect {@link ConfigProvider.fromEnv} trie).
 */
const optionalStringVar = (segments: readonly string[]) =>
	Config.schema(Schema.String, [...segments]).pipe(Config.option);

/**
 * `EFFECT2D_OTEL_ROOT` — optional root directory for gameplay telemetry output.
 */
export const effect2dOtelRoot = optionalStringVar(["EFFECT2D", "OTEL", "ROOT"]);

/**
 * `EFFECT2D_OTEL_SESSION_DIR` — optional existing telemetry session directory to reuse.
 */
export const effect2dOtelSessionDir = optionalStringVar([
	"EFFECT2D",
	"OTEL",
	"SESSION",
	"DIR",
]);
