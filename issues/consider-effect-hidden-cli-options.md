# Consider hidden Effect CLI options for internal gameplay tooling

Effect `4.0.0-beta.69` added `Flag.withHidden` and `Param.withHidden`, and `4.0.0-beta.70` added `Command.withHidden`.

Effect2d already has a gameplay commentary CLI. A follow-up should consider hidden flags or subcommands for debug-only telemetry workflows, session repair tools, or experimental capture modes that need to remain invocable by exact name without becoming part of the documented game author surface.

Source: https://github.com/Effect-TS/effect-smol/blob/440505f845a7c207b8e98e3260f0bdf1690ac1c7/packages/effect/CHANGELOG.md
