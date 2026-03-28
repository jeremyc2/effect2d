# UI

> Public UI API.

## UI

### FontDefinition

- Kind: interface
- Source: `src/ui/UI.ts:10`

A bitmap or authored font definition known to the UI service. Width and spacing fields let the service measure and wrap text without native font metrics.

### TextLine

- Kind: interface
- Source: `src/ui/UI.ts:20`

A single wrapped line of measured text.

### TextLayout

- Kind: interface
- Source: `src/ui/UI.ts:26`

The measured layout of a text block. This is useful both for drawing and for higher-level pagination logic.

### UIBounds

- Kind: interface
- Source: `src/ui/UI.ts:35`

Rectangular bounds used by UI drawing helpers.

### DialoguePage

- Kind: interface
- Source: `src/ui/UI.ts:44`

A single dialogue page produced by pagination. `hasNextPage` tells your dialogue state machine whether advancing should close the box or show another page.

### DrawDialogueBoxOptions

- Kind: interface
- Source: `src/ui/UI.ts:52`

Options for drawing a dialogue box. The box uses `page.layout` as already-measured content, so you usually pair this with `UI.paginateDialogue`.

### MenuNavigationOptions

- Kind: interface
- Source: `src/ui/UI.ts:62`

Options for resolving conventional menu navigation.



Default action names are the common UI conventions:
- `previousAction`: `"menu-up"`
- `nextAction`: `"menu-down"`
- `confirmAction`: `"menu-confirm"`
- `cancelAction`: `"menu-cancel"`

### MenuNavigationResult

- Kind: interface
- Source: `src/ui/UI.ts:83`

The result of a single menu navigation update. `moved`, `confirmed`, and `cancelled` are mutually independent so a caller can respond to whichever transition happened this frame.

### DuplicateFontError

- Kind: error
- Source: `src/ui/UI.ts:113`

Indicates that a font id was loaded more than once into the UI service.

### InvalidFontDefinitionError

- Kind: error
- Source: `src/ui/UI.ts:121`

Indicates that a font definition is missing required authored data.

### UnknownFontError

- Kind: error
- Source: `src/ui/UI.ts:130`

Indicates that text layout or drawing referenced an unknown font id.

### UI

- Kind: service
- Source: `src/ui/UI.ts:284`

High-level text, menu, and dialogue helpers built on top of [Graphics](./llms/graphics.md#graphics-graphics).



`UI` is intentionally small and opinionated. It handles the repetitive parts
of dialogue boxes, framed panels, bitmap-font measurement, and menu
navigation so your game code can stay focused on its own state machine.

#### Methods

- `drawCursor: ( bounds: UIBounds, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawDialogueBox: ( options: DrawDialogueBoxOptions, ) => Effect.Effect<void, GraphicsFrameNotOpenError | UnknownFontError>`
- `drawFrame: ( bounds: UIBounds, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawHighlight: ( bounds: UIBounds, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawPanel: ( bounds: UIBounds, fillColor?: Color, borderColor?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawTextBlock: (options: { readonly align?: "center" | "left" | "right"`
- `fontId: string`
- `position: CameraVector`
- `text: string`
- `loadFont: ( definition: FontDefinition, ) => Effect.Effect<void, DuplicateFontError | InvalidFontDefinitionError>`
- `measureText: ( fontId: string, text: string, ) => Effect.Effect<TextLayout, UnknownFontError>`
- `paginateDialogue: (options: { readonly fontId: string`
- `maxLines: number`
- `maxWidth: number`
- `text: string`
- `resolveMenuInput: ( options: MenuNavigationOptions, ) => Effect.Effect<MenuNavigationResult, never>`
- `wrapText: ( fontId: string, text: string, maxWidth: number, ) => Effect.Effect<TextLayout, UnknownFontError>`