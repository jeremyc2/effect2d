import { Effect, Layer, Ref, ServiceMap } from "effect";

/** Axis-aligned bounding box collision shape. @public */
export interface Aabb {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

/** Circle collision shape described by center position and radius. @public */
export interface Circle {
	readonly radius: number;
	readonly x: number;
	readonly y: number;
}

/** Free-form collision channel name such as `"player"`, `"enemy"`, or `"wall"`. @public */
export type CollisionGroup = string;

/** List of groups a query or body should interact with. An empty mask means "match every group". @public */
export type CollisionMask = ReadonlyArray<CollisionGroup>;

/**
 * Supported collision shape variants.
 *
 * @public
 *
 * Available kinds:
 * - `aabb`
 * - `circle`
 */
export type CollisionShape =
	| {
			readonly shape: Aabb;
			readonly kind: "aabb";
	  }
	| {
			readonly shape: Circle;
			readonly kind: "circle";
	  };

/**
 * Registered collision participant stored in the world.
 *
 * @public
 *
 * `isTrigger` bodies are reported by overlap queries but are ignored by
 * `collidesWithSolid`.
 */
export interface CollisionBody {
	readonly group: CollisionGroup;
	readonly id: string;
	readonly isTrigger: boolean;
	readonly mask: CollisionMask;
	readonly shape: CollisionShape;
}

/** Conventional damage-dealing body payload used by gameplay code on top of the core collision types. @public */
export interface Hitbox {
	readonly body: CollisionBody;
	readonly damage: number;
}

/** Conventional recipient body payload used by gameplay code on top of the core collision types. @public */
export interface Hurtbox {
	readonly body: CollisionBody;
	readonly targetId: string;
}

function doesMaskAllowGroup(
	mask: CollisionMask,
	group: CollisionGroup,
): boolean {
	return mask.length === 0 || mask.includes(group);
}

/** Pure overlap test for two axis-aligned rectangles. @public */
export function doesAabbOverlap(left: Aabb, right: Aabb): boolean {
	return (
		left.x < right.x + right.width &&
		left.x + left.width > right.x &&
		left.y < right.y + right.height &&
		left.y + left.height > right.y
	);
}

/** Pure overlap test for two circles. @public */
export function doesCircleOverlap(left: Circle, right: Circle): boolean {
	const dx = left.x - right.x;
	const dy = left.y - right.y;
	const radiusSum = left.radius + right.radius;

	return dx * dx + dy * dy <= radiusSum * radiusSum;
}

/** Pure overlap test between an axis-aligned rectangle and a circle. @public */
export function doesAabbOverlapCircle(aabb: Aabb, circle: Circle): boolean {
	const closestX = Math.max(aabb.x, Math.min(circle.x, aabb.x + aabb.width));
	const closestY = Math.max(aabb.y, Math.min(circle.y, aabb.y + aabb.height));
	const dx = circle.x - closestX;
	const dy = circle.y - closestY;

	return dx * dx + dy * dy <= circle.radius * circle.radius;
}

/** Pure overlap test that dispatches to the correct shape-specific algorithm. @public */
export function doesShapeOverlap(
	left: CollisionShape,
	right: CollisionShape,
): boolean {
	if (left.kind === "aabb" && right.kind === "aabb") {
		return doesAabbOverlap(left.shape, right.shape);
	}

	if (left.kind === "circle" && right.kind === "circle") {
		return doesCircleOverlap(left.shape, right.shape);
	}

	if (left.kind === "aabb" && right.kind === "circle") {
		return doesAabbOverlapCircle(left.shape, right.shape);
	}

	if (left.kind === "circle" && right.kind === "aabb") {
		return doesAabbOverlapCircle(right.shape, left.shape);
	}

	return false;
}

/** Converts a 2D tile coordinate into a flat row-major array index. @public */
export function getTileIndex(width: number, x: number, y: number): number {
	return y * width + x;
}

/** Reads one tile id from a flat row-major tile array. @public */
export function getTileAt(
	tiles: ReadonlyArray<number>,
	width: number,
	x: number,
	y: number,
): number | undefined {
	return tiles[getTileIndex(width, x, y)];
}

/** Returns whether the addressed tile exists and belongs to the provided solid tile set. @public */
export function isSolidTileAt(
	tiles: ReadonlyArray<number>,
	width: number,
	x: number,
	y: number,
	solidTileIds: ReadonlySet<number>,
): boolean {
	const tile = getTileAt(tiles, width, x, y);
	return tile !== undefined && solidTileIds.has(tile);
}

/**
 * Minimal in-memory collision registry and overlap query service.
 *
 * @public
 *
 * This service is intentionally small: it tracks authored bodies, answers
 * overlap queries, and distinguishes trigger-only bodies from solid bodies.
 * It is a good fit for room-scale gameplay where collisions are explicit and
 * testable rather than delegated to a heavyweight physics engine.
 */
export class CollisionWorld extends ServiceMap.Service<
	CollisionWorld,
	{
		readonly registerBody: (body: CollisionBody) => Effect.Effect<void>;
		readonly removeBody: (bodyId: string) => Effect.Effect<void>;
		readonly overlapsAabb: (left: Aabb, right: Aabb) => Effect.Effect<boolean>;
		readonly overlapsCircle: (
			left: Circle,
			right: Circle,
		) => Effect.Effect<boolean>;
		readonly queryOverlaps: (
			shape: CollisionShape,
			mask?: CollisionMask,
		) => Effect.Effect<ReadonlyArray<CollisionBody>>;
		readonly collidesWithSolid: (
			shape: CollisionShape,
			mask?: CollisionMask,
		) => Effect.Effect<boolean>;
		readonly queryTriggers: (
			shape: CollisionShape,
			mask?: CollisionMask,
		) => Effect.Effect<ReadonlyArray<CollisionBody>>;
	}
>()("effect2d/collision/CollisionWorld") {
	static readonly layer = Layer.effect(
		CollisionWorld,
		Effect.gen(function* () {
			const bodies = yield* Ref.make(new Map<string, CollisionBody>());

			const registerBody = Effect.fn("CollisionWorld.registerBody")(function* (
				body: CollisionBody,
			) {
				yield* Ref.update(bodies, (current) => {
					const next = new Map(current);
					next.set(body.id, body);
					return next;
				});
			});

			const removeBody = Effect.fn("CollisionWorld.removeBody")(function* (
				bodyId: string,
			) {
				yield* Ref.update(bodies, (current) => {
					const next = new Map(current);
					next.delete(bodyId);
					return next;
				});
			});

			const queryOverlaps = Effect.fn("CollisionWorld.queryOverlaps")(
				function* (shape: CollisionShape, mask: CollisionMask = []) {
					const currentBodies = yield* Ref.get(bodies);
					return Array.from(currentBodies.values()).filter(
						(body) =>
							doesMaskAllowGroup(mask, body.group) &&
							doesShapeOverlap(shape, body.shape),
					);
				},
			);

			const collidesWithSolid = Effect.fn("CollisionWorld.collidesWithSolid")(
				function* (shape: CollisionShape, mask: CollisionMask = []) {
					const overlaps = yield* queryOverlaps(shape, mask);
					return overlaps.some((body) => body.isTrigger === false);
				},
			);

			const queryTriggers = Effect.fn("CollisionWorld.queryTriggers")(
				function* (shape: CollisionShape, mask: CollisionMask = []) {
					const overlaps = yield* queryOverlaps(shape, mask);
					return overlaps.filter((body) => body.isTrigger);
				},
			);

			return CollisionWorld.of({
				registerBody,
				removeBody,
				overlapsAabb: (left: Aabb, right: Aabb) =>
					Effect.succeed(doesAabbOverlap(left, right)),
				overlapsCircle: (left: Circle, right: Circle) =>
					Effect.succeed(doesCircleOverlap(left, right)),
				queryOverlaps,
				collidesWithSolid,
				queryTriggers,
			});
		}),
	);
}
