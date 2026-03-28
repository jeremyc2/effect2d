# Maps

> Public Maps API.

## MapContent

### RoomMetadata

- Kind: type
- Source: `src/maps/MapContent.ts:1`

Free-form metadata attached to a room or room object. Use this for authored data your own game understands.

### TilePlane

- Kind: interface
- Source: `src/maps/MapContent.ts:4`

A dense tile plane authored for a room. Tiles are stored in row-major order.

### RoomObject

- Kind: interface
- Source: `src/maps/MapContent.ts:12`

A positioned authored room object.



`kind` is the extension point your game usually switches on when translating
room content into gameplay entities.

### ObjectPlane

- Kind: interface
- Source: `src/maps/MapContent.ts:30`

A named collection of room objects, often used to separate gameplay objects from editor-only helpers or decorative markers.

### RoomContent

- Kind: interface
- Source: `src/maps/MapContent.ts:36`

The canonical authored representation of a room.



A room combines tile planes, object planes, and optional metadata into one
value that can be validated, queried, serialized, and loaded into gameplay.

### SpawnPoint

- Kind: interface
- Source: `src/maps/MapContent.ts:51`

A room object that identifies a spawn location. The required metadata key is `spawnId`.

### TransitionZone

- Kind: interface
- Source: `src/maps/MapContent.ts:60`

A room object that moves the player to another room. `targetSpawnId` lets the destination room choose which spawn point to use.

### TriggerZone

- Kind: interface
- Source: `src/maps/MapContent.ts:70`

A generic authored trigger zone for game-defined interactions that are not special-cased by the map helpers.

## MapError

### MapValidationError

- Kind: error
- Source: `src/maps/MapError.ts:3`

Indicates that authored room content failed validation.

### MapSerializationError

- Kind: error
- Source: `src/maps/MapError.ts:12`

Indicates that room content could not be serialized or deserialized.

## MapQueries

### getRoomObjects

- Kind: function
- Source: `src/maps/MapQueries.ts:8`

Returns every authored object across all object planes in a room. Use this when plane boundaries do not matter to the query you are writing.

### getRoomObjectById

- Kind: function
- Source: `src/maps/MapQueries.ts:13`

Finds one authored room object by id.

### getRoomObjectsByKind

- Kind: function
- Source: `src/maps/MapQueries.ts:21`

Filters room objects by authored `kind`, which is useful for game-specific object families in addition to the built-in helpers below.

### getRoomSpawnPoints

- Kind: function
- Source: `src/maps/MapQueries.ts:29`

Returns all authored spawn points in a room.

### getRoomTransitionZones

- Kind: function
- Source: `src/maps/MapQueries.ts:36`

Returns all authored transition zones in a room.

## MapRepository

### MapRepository

- Kind: service
- Source: `src/maps/MapRepository.ts:7`

A validated in-memory repository of authored rooms.

#### Methods

- `loadRoom: ( roomId: string, ) => Effect.Effect<RoomContent, MapValidationError>`
- `getRoomObjectById: ( roomId: string, objectId: string, ) => Effect.Effect< RoomContent["objectPlanes"][number]["entries"][number], MapValidationError >`

## RoomBuilder

### defineTilePlane

- Kind: function
- Source: `src/maps/RoomBuilder.ts:12`

Identity helper for authored tile planes. Useful when you want inference and generated docs without introducing a builder DSL.

### defineObjectPlane

- Kind: function
- Source: `src/maps/RoomBuilder.ts:17`

Identity helper for authored object planes.

### defineRoom

- Kind: function
- Source: `src/maps/RoomBuilder.ts:22`

Identity helper for authored rooms.



```ts
const room = defineRoom({
 id: "field",
 metadata: {},
 tilePlanes: [],
 objectPlanes: [],
});
```

### defineRoomObject

- Kind: function
- Source: `src/maps/RoomBuilder.ts:40`

Identity helper for generic room objects when you are using a custom `kind`.

### createSpawnPoint

- Kind: function
- Source: `src/maps/RoomBuilder.ts:45`

Builds a typed spawn-point object and inserts the fixed `kind: "spawn-point"` tag for you.

### createTransitionZone

- Kind: function
- Source: `src/maps/RoomBuilder.ts:53`

Builds a typed transition-zone object and inserts the fixed `kind: "transition-zone"` tag for you.

### createTriggerZone

- Kind: function
- Source: `src/maps/RoomBuilder.ts:63`

Builds a typed trigger-zone object and inserts the fixed `kind: "trigger-zone"` tag for you.

### defineRoomMetadata

- Kind: function
- Source: `src/maps/RoomBuilder.ts:73`

Identity helper for room metadata when you want inline authored objects to stay strongly typed.