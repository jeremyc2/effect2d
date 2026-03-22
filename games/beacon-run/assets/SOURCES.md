# Asset Sources

`Beacon Run` currently draws from two external asset sources:

## Cavern

Some placeholder visual and sound assets in this folder are borrowed from the neighboring `../cavern` repository so we can keep the native playable slice fully local while the engine and game architecture settle.

Current `cavern`-sourced assets include:

- `images/title-screen.png`
- `images/field-room-background.png`
- `images/shrine-room-background.png`
- `images/scout-idle.png`
- `images/beacon-unlit.png`
- `images/beacon-lit.png`
- `fonts/ui-body.ttf`
- `audio/sfx/menu-confirm.wav`
- `audio/sfx/pause-toggle.wav`
- `audio/sfx/room-transition.wav`
- `audio/sfx/beacon-ignite.wav`

## Freesound

The current menu/background music is sourced from Freesound because the earlier placeholder loop was too short to hold up in repeated native play sessions.

- `audio/music/beacon-run-theme.mp3`
  Source: [Futuristic Rhythmic Game Ambience by PatrickLieberkind](https://freesound.org/people/PatrickLieberkind/sounds/396458/)
  Duration: `3:21.158`
  License: [Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
  Notes: chosen because it is long enough to survive looping better than the previous placeholder and the author explicitly notes that there are opportunities for looping the track.

When we replace placeholder assets later, this file should stay current so the repo remains honest about provenance.
