# Collision

> Public Collision API.

## CollisionWorld

### Aabb

- Kind: interface
- Source: `src/collision/CollisionWorld.ts:3`

Axis-aligned bounding box collision shape.

### Circle

- Kind: interface
- Source: `src/collision/CollisionWorld.ts:11`

Circle collision shape described by center position and radius.

### CollisionGroup

- Kind: type
- Source: `src/collision/CollisionWorld.ts:18`

Free-form collision channel name such as `"player"`, `"enemy"`, or `"wall"`.

### CollisionMask

- Kind: type
- Source: `src/collision/CollisionWorld.ts:21`

List of groups a query or body should interact with. An empty mask means "match every group".

### CollisionShape

- Kind: type
- Source: `src/collision/CollisionWorld.ts:24`

Supported collision shape variants.



Available kinds:
- `aabb`
- `circle`

### CollisionBody

- Kind: interface
- Source: `src/collision/CollisionWorld.ts:43`

Registered collision participant stored in the world.



`isTrigger` bodies are reported by overlap queries but are ignored by
`collidesWithSolid`.

### Hitbox

- Kind: interface
- Source: `src/collision/CollisionWorld.ts:59`

Conventional damage-dealing body payload used by gameplay code on top of the core collision types.

### Hurtbox

- Kind: interface
- Source: `src/collision/CollisionWorld.ts:65`

Conventional recipient body payload used by gameplay code on top of the core collision types.

### doesAabbOverlap

- Kind: function
- Source: `src/collision/CollisionWorld.ts:78`

Pure overlap test for two axis-aligned rectangles.

### doesCircleOverlap

- Kind: function
- Source: `src/collision/CollisionWorld.ts:88`

Pure overlap test for two circles.

### doesAabbOverlapCircle

- Kind: function
- Source: `src/collision/CollisionWorld.ts:97`

Pure overlap test between an axis-aligned rectangle and a circle.

### doesShapeOverlap

- Kind: function
- Source: `src/collision/CollisionWorld.ts:107`

Pure overlap test that dispatches to the correct shape-specific algorithm.

### getTileIndex

- Kind: function
- Source: `src/collision/CollisionWorld.ts:131`

Converts a 2D tile coordinate into a flat row-major array index.

### getTileAt

- Kind: function
- Source: `src/collision/CollisionWorld.ts:136`

Reads one tile id from a flat row-major tile array.

### isSolidTileAt

- Kind: function
- Source: `src/collision/CollisionWorld.ts:146`

Returns whether the addressed tile exists and belongs to the provided solid tile set.

### CollisionWorld

- Kind: service
- Source: `src/collision/CollisionWorld.ts:158`

Minimal in-memory collision registry and overlap query service.



This service is intentionally small: it tracks authored bodies, answers
overlap queries, and distinguishes trigger-only bodies from solid bodies.
It is a good fit for room-scale gameplay where collisions are explicit and
testable rather than delegated to a heavyweight physics engine.

#### Methods

- `registerBody: (body: CollisionBody) => Effect.Effect<void>`
- `removeBody: (bodyId: string) => Effect.Effect<void>`
- `overlapsAabb: (left: Aabb, right: Aabb) => Effect.Effect<boolean>`
- `overlapsCircle: ( left: Circle, right: Circle, ) => Effect.Effect<boolean>`
- `queryOverlaps: ( shape: CollisionShape, mask?: CollisionMask, ) => Effect.Effect<ReadonlyArray<CollisionBody>>`
- `collidesWithSolid: ( shape: CollisionShape, mask?: CollisionMask, ) => Effect.Effect<boolean>`
- `queryTriggers: ( shape: CollisionShape, mask?: CollisionMask, ) => Effect.Effect<ReadonlyArray<CollisionBody>>`