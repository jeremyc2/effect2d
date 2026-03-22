# Starter

This folder is the canonical small starter for `effect2d`.

It demonstrates:

- a Layer-composed game runtime
- multiple domain state services
- scene registration and scoped scene instances
- coordinator-driven multi-domain orchestration
- a gameplay director for movement, transitions, pickups, and a simple encounter
- selective event-driven follow-up through `ScriptEvents`
- input bindings
- save participants
- debug overlay toggles
- bootstrapping through `Effect.runPromise(...)`

The current entry point is [main.ts](./main.ts).

The important composition root is [StarterGame.ts](./game/StarterGame.ts).
The main coordination example is [StarterCoordinator.ts](./game/directors/StarterCoordinator.ts).
The gameplay slice example is [StarterGameplayDirector.ts](./game/directors/StarterGameplayDirector.ts).
