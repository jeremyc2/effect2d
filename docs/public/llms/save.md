# Save

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Save API.

## SaveCoordinator

### SaveCoordinatorType

- Kind: type
- Source: `src/save/SaveCoordinator.ts:23`

surface of [SaveCoordinator](./llms/save.md#save-savecoordinator).

Slot methods are typed with `never` on the requirements channel because the
coordinator re-provides the current `Context.Context` to each
participant effect via `Effect.provideContext` (see `SaveCoordinator.layer`).
Import/export only touch the in-memory document and also stay `never` there.

### SaveCoordinatorOptions

- Kind: interface
- Source: `src/save/SaveCoordinator.ts:101`

Configuration for building a [SaveCoordinator](./llms/save.md#save-savecoordinator).



`participants` is the important part: one entry per state area you want to
capture and restore. `migrations` is only needed after you start evolving
persisted formats across released versions.

### SaveCoordinator

- Kind: service
- Source: `src/save/SaveCoordinator.ts:118`

Coordinates save snapshots, restores, imports, and migrations.



Game authors typically provide a list of [SaveParticipant](./llms/save.md#save-saveparticipant) values, one
per domain state area they want to persist. The coordinator handles the
boring parts:

- composing those participant captures into a single document
- restoring participant state from a slot
- importing old documents through migrations
- exposing typed failures when documents are missing or incompatible

```ts
const saveLayer = SaveCoordinator.layer({
 version: 1,
 participants: [playerSaveParticipant, worldSaveParticipant],
});
```

## SaveDocument

### SaveSlotId

- Kind: type
- Source: `src/save/SaveDocument.ts:4`

A stable identifier for a saved slot such as `"autosave"` or `"slot-1"`.

### SaveSlotDocument

- Kind: interface
- Source: `src/save/SaveDocument.ts:7`

The persisted contents of a single save slot.



`participantStates` is keyed by each registered [SaveParticipant](./llms/save.md#save-saveparticipant)'s
`key`.

### SaveDocument

- Kind: interface
- Source: `src/save/SaveDocument.ts:23`

The full persisted save document for a game. `version` is the migration target used by [SaveCoordinator](./llms/save.md#save-savecoordinator).

### SaveParticipant

- Kind: interface
- Source: `src/save/SaveDocument.ts:29`

Participates in save capture and restore.



Each game-owned state service that wants to be saved can expose one
`SaveParticipant`.

Capture and restore are normal `Effect`s: they almost always **require**
game services (via `yield*`). Model that by choosing a type parameter `R`
that is the union of every service those effects may `yield*`. Using plain
`Effect.Effect<…>` without `R` defaults `R` to `never`, which does **not**
match real participants.

`SaveCoordinator.layer` reads the current service map and applies
`Effect.provideContext` to each participant effect so the coordinator’s
slot methods stay typed with `never` on the requirements channel (no `as`
needed at call sites).

```ts
type MySaveR = PlayerState | WorldState;

const playerSaveParticipant: SaveParticipant<MySaveR> = {
 key: "player",
 capture: PlayerState.snapshot,
 restore: (state) => PlayerState.restore(state),
};
```

### SaveMigration

- Kind: interface
- Source: `src/save/SaveDocument.ts:66`

A typed migration between persisted save versions. Each migration should move the document from exactly one version to the next expected version.

### SaveSlotDocumentSchema

- Kind: const
- Source: `src/save/SaveDocument.ts:77`

Runtime schema for a single save slot document. Use this when you need Effect Schema decoding outside of [SaveCoordinator](./llms/save.md#save-savecoordinator).

### SaveDocumentSchema

- Kind: const
- Source: `src/save/SaveDocument.ts:84`

Runtime schema for the top-level save document.

## SaveError

### SaveParticipantKeyConflictError

- Kind: error
- Source: `src/save/SaveError.ts:3`

Indicates that multiple save participants claimed the same persistence key.

### SaveSlotNotFoundError

- Kind: error
- Source: `src/save/SaveError.ts:11`

Indicates that the requested save slot does not exist in the document.

### SaveDocumentDecodeError

- Kind: error
- Source: `src/save/SaveError.ts:19`

Indicates that save data could not be decoded into the documented schema.

### SaveMigrationExecutionError

- Kind: error
- Source: `src/save/SaveError.ts:27`

Indicates that a migration threw or returned a failure while running.

### SaveMigrationMissingError

- Kind: error
- Source: `src/save/SaveError.ts:35`

Indicates that no migration path exists between two save versions.

### SaveMigrationFailedError

- Kind: error
- Source: `src/save/SaveError.ts:44`

Indicates that a migration failed while moving a document between versions.

### SaveMigrationVersionMismatchError

- Kind: error
- Source: `src/save/SaveError.ts:53`

Indicates that a migration produced a document version other than the expected target.