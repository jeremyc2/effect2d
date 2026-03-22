# Starter

This folder is the canonical small starter for `effect2d`.

It demonstrates:

- a Layer-composed game runtime
- multiple domain state services
- scene registration and scoped scene instances
- input bindings
- save participants
- debug overlay toggles
- bootstrapping through `Effect.runPromise(...)`

The current entry point is [main.ts](./main.ts).

The important composition root is [StarterGame.ts](./game/StarterGame.ts).
