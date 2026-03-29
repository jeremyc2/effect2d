# Save

> Public Save API.

## SaveCoordinator

### SaveCoordinatorOptions

- Kind: interface
- Source: `src/save/SaveCoordinator.ts:68`

Configuration for building a [SaveCoordinator](./llms/save.md#save-savecoordinator).



`participants` is the important part: one entry per state area you want to
capture and restore. `migrations` is only needed after you start evolving
persisted formats across released versions.

### SaveCoordinator

- Kind: service
- Source: `src/save/SaveCoordinator.ts:85`

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

#### Methods

- `restoreSlot: ( slotId: SaveSlotId, ) => Effect.Effect<void, SaveSlotNotFoundError>`
- `exportDocument: Effect.Effect<SaveDocument>`
- `importDocument: ( document: unknown, ) => Effect.Effect< void, | SaveDocumentDecodeError | SaveMigrationFailedError | SaveMigrationMissingError | SaveMigrationVersionMismatchError >`
- `snapshotSlot: ( slotId: SaveSlotId, ) => Effect.Effect<SaveSlotDocument>`
- `writeSlot: (slotId: SaveSlotId) => Effect.Effect<SaveDocument>`

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

```ts
const playerSaveParticipant: SaveParticipant = {
 key: "player",
 capture: PlayerState.snapshot,
 restore: (state) => PlayerState.restore(state),
};
```

### SaveMigration

- Kind: interface
- Source: `src/save/SaveDocument.ts:53`

A typed migration between persisted save versions. Each migration should move the document from exactly one version to the next expected version.

### SaveSlotDocumentSchema

- Kind: const
- Source: `src/save/SaveDocument.ts:64`

Runtime schema for a single save slot document. Use this when you need Effect Schema decoding outside of [SaveCoordinator](./llms/save.md#save-savecoordinator).

### SaveDocumentSchema

- Kind: const
- Source: `src/save/SaveDocument.ts:71`

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