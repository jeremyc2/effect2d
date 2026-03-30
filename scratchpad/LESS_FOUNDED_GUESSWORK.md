# Less founded guesswork

_(AI-edited only. Tie answers to numbered items in `LESS_FOUNDED_CRITICISM.md`.)_

## 1. Are we using the right abstractions?

### 1.1 Should we have directors?

Feels fine to me. The engine never *requires* a type called Director; it is mostly vocabulary plus a habit of splitting “what the world does” from “what we draw.” If the word feels corporate, you could call them coordinators or brains or whatever—same job. The useful bit is not the name but having two places so tests and the frame loop do not turn into one mega-file of mixed concerns. Whether two files is enough for a real game is a different question (see 1.2).

### 1.2 Cavern’s LOC pile-up in two directors

Yeah, that’s real. The sample really does park a ton of behavior in `CavernGameplayDirector` and `CavernPresentationDirector`, while the actual `SceneDefinition`s are basically empty shells. That is less “directors are wrong” and more “this sample chose centralization over scene-sized modules.” For a tiny game it is easy to grep; for growth you would probably peel helpers out (pure functions, draw chunks, room logic) or let scenes own more of update/draw so the directors stay thin glue. No need to apologize for how the sample grew—just know it is one style, not the only one the engine allows.

### 1.3 How much should the engine prescribe? Linter / LSP?

Today the prescription is mostly: Effect, layers, a handful of services, scene lookup + director. That is already a shape, but it is still “compose these Legos,” not “fill in this template class.” A custom LSP sounds like a lot of maintenance for a small ecosystem; I would not rush it. A short “patterns we like” doc (or even this scratchpad) probably moves the needle more than lint rules that yell about director naming. If someday the same mistake keeps showing up in every game, *then* a lint rule is worth it.

---

## 2. Cavern: underusing / overusing what?

### 2.1 If something is underused, why?

My loose ranking:

- **Sequence / Cutscene / SaveCoordinator** — underused because Cavern is not doing scripted beats, cinematic dialogue flows, or persistence yet. Feels like “has not needed it,” not “broken API.”
- **Scene hooks** (`update`, `draw`, etc. on `SceneDefinition`) — underused because the sample wired the loop through directors instead. Intentional shortcut, but it can make scenes look pointless on paper even though `SceneDirector` is doing real work (stack, lifecycle elsewhere).
- **Docs** — might undersell that tradeoff (directors-heavy vs scene-heavy), so someone could think they *must* copy Cavern’s layout.

If something felt hard to use, I would guess **integration surface area** (layers, providing the right stack) before “this subsystem is bad.” But that is a vibe, not a usability study.

### 2.2 If something is overused, what’s the pull?

**Immediate-mode `Graphics`** — you touch it every frame because that is how the engine paints; “overuse” here might just mean “a lot of drawing code in one file,” which is a refactor / split problem, not a wrong API.

**`SceneDirector` / scene id checks** — cheap way to branch menu vs overworld; totally reasonable. Overuse would look like stuffing *everything* through snapshot checks instead of pushing logic into scenes—again, Cavern’s shape, not a trap in the library.

---

## 3. Simplifying the engine without ditching principles

Principles like explicit layers, typed errors, and testable services are probably non-negotiable if Effect2d stays Effect2d.

Where simplification might actually live:

- **Fewer “you must read five docs to wire one feature” moments** — often documentation and one golden path, not deleting `Layer`.
- **Samples that show an alternative** (e.g. a chunk of logic in scene `update` vs in a director) so people see two grooves.
- **Deferring new subsystems** until a second game asks for them — avoids engine bloat without simplifying code that already exists.

I would not rip out directors from the *language* of the project; I might just avoid implying every game should look like Cavern 1.0.

---

## 4. How can the docs be improved?

Some half-baked ideas:

- **One friendly “how a frame runs” diagram or paragraph** — frame source → tick → draw — so newcomers are not reverse-engineering from `Engine` and tests.
- **Call out Cavern explicitly** as one layout, not *the* layout.
- **“When to reach for X”** blurbs for Sequence, Cutscene, Save — even three sentences each lowers the “is this dead code?” feeling.
- Keep the LLM-oriented docs in sync when the story changes, since that is probably how a lot of people skim the API now.

---

_Last synced with the numbered list in `LESS_FOUNDED_CRITICISM.md` as of this pass. Refresh whenever that file moves._
