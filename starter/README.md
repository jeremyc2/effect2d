# Starter

This folder is the canonical small starter for `effect2d`.

It demonstrates:

- a Layer-composed game runtime
- multiple domain state services
- scene registration and scoped scene instances
- coordinator-driven multi-domain orchestration
- a gameplay director for movement, transitions, pickups, and a simple encounter
- a dedicated dialogue state service that owns active conversation pages
- a presentation director for menu/gameplay/pause rendering
- room/session helpers so transitions and room loading stay game-shaped
- starter music and sound-effect cues
- collision-driven interactions and debug overlay rendering
- authored code-defined rooms loaded through `MapRepository`
- selective event-driven follow-up through `ScriptEvents`
- input bindings
- save participants
- dialogue progress carried by save participants
- debug overlay toggles
- bootstrapping through `Effect.runPromise(...)`

The current entry point is [main.ts](./main.ts).

The important composition root is [StarterGame.ts](./game/StarterGame.ts).
The main coordination example is [StarterCoordinator.ts](./game/directors/StarterCoordinator.ts).
The gameplay slice example is [StarterGameplayDirector.ts](./game/directors/StarterGameplayDirector.ts).
The rendering and audio example is [StarterPresentationDirector.ts](./game/directors/StarterPresentationDirector.ts).
The authored room content lives in [StarterRooms.ts](./game/content/StarterRooms.ts).
