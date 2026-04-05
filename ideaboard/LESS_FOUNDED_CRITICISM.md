# Less founded criticism

_(Human-edited only. Number your concerns so responses in `LESS_FOUNDED_GUESSWORK.md` can refer to them.)_

1. Are we using the right abstractions?
   1. Should we have directors?
   2. In the cavern game, most of the lines of code are split between the gameplay director and the presentation director, to the point where the game logic is mostly concentrated in just a couple of files.
   3. How much should the engine prescribe that games are built a certain way? Should we build a linter/LSP for the engine?
2. Which parts of the game engine is Cavern underutilizing? Overutilizing?
   1. If underutilized: Is that because it doesn't need it, that part of the library is not well documented, is it overly complex, is the interface unintuitive, is it not well integrated with the rest of the engine, is it not flexible or powerful enough, is it broken or buggy, is it not very discoverable, is it redundant with other parts of the engine, does it have too much boilerplate, does it not fit the engine's design philosophy?
   2. If overutilized: What is it about that part of the library that leads to it being overutilized?
3. In which ways could the game engine be simplified without compromising on its core principles?
4. How can the docs be improved?

## UPDATE Apr 4:

I've been learning about ECS (Entity Component System) and researching the best way to fold it into an Effect codebase. Based on what I've read:

Entity: Just an empty gmae object with an ID.
Component: Features or abilities that can be added to entities.
System: Update loop. Iterates over entities and updates them based on their components.

Where `Entity + Components` is an Effect Schema stitched together of many different sub-schemas.
And a system is an Effect Service, of course.

```ts
import { Schema } from "effect";

const jumpComponentSchema = Schema.Struct({
   kind: Schema.Literal("jump"),
   jumpForce: Schema.Number,
});

const inventoryComponentSchema = Schema.Struct({
   kind: Schema.Literal("inventory"),
   items: Schema.Array(Schema.String),
});

const playerEntitySchema = Schema.Struct({
   kind: Schema.Literal("player"),
   jump: jumpComponentSchema.pipe(Schema.optional),
   inventory: inventoryComponentSchema.pipe(Schema.optional),
});
```

Disclaimer: I know we have it in the README.md that building an ECS engine is a non-goal. But I think maybe we should reconsider.