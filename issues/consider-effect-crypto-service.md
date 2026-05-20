# Consider the Effect `Crypto` service for engine identifiers and digests

Effect `4.0.0-beta.68` added a platform-agnostic `Crypto` service for secure random bytes, UUIDv4 / UUIDv7 generation, and digest operations.

This update already moves gameplay telemetry session id creation away from the removed `Random.nextUUIDv4` helper. A follow-up should audit remaining identifier and digest-shaped work, especially telemetry span id generation and future save or authored content hashing, to see where depending on `Crypto.Crypto` makes the engine less Bun-specific while preserving deterministic gameplay paths that should stay on **Seeded randomness**.

Source: https://github.com/Effect-TS/effect-smol/releases/tag/effect%404.0.0-beta.68
