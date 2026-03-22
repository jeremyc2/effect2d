# Beacon Run

`Beacon Run` is the first real small game pressure-test for `effect2d`.

It is intentionally separate from the starter. The goal is to prove that the
engine can support a new game-specific domain without collapsing back into
starter-specific assumptions.

This game currently exercises:

- a separate Layer-composed game runtime
- its own room content and state services
- a room transition from field to shrine
- a beacon-lighting objective
- save participants for game-specific progress
- a dedicated gameplay and presentation path
- a native SDL window backed by Canvas2D for real keyboard-driven play

The entry point is [main.ts](./main.ts).
The composition root is [BeaconRunGame.ts](./game/BeaconRunGame.ts).

## Run It

From the repo root:

```bash
bun run beacon-run:native
```

Controls:

- `Enter` starts the run from the title screen
- Arrow keys move the scout
- `Space` lights the beacon when standing near it
- `Escape` pauses and unpauses
- `F3` toggles the debug overlay

## Current Native Scope

The first native pass is focused on a real playable window:

- SDL owns the macOS window and raw input events
- Canvas2D draws the recorded `Graphics` frame to the SDL window
- borrowed local assets under `games/beacon-run/assets` provide the initial images and font

Audio cues are still handled by the headless `Audio` service state for now, so the native playable build is currently visual/input-first while we finish the live audio output path.
