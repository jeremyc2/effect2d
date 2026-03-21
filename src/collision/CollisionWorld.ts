import { Effect, Layer, Ref, ServiceMap } from "effect";

export interface Aabb {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface Circle {
	readonly radius: number;
	readonly x: number;
	readonly y: number;
}

export type CollisionGroup = string;

export type CollisionMask = ReadonlyArray<CollisionGroup>;

export type CollisionShape =
	| {
			readonly shape: Aabb;
			readonly kind: "aabb";
	  }
	| {
			readonly shape: Circle;
			readonly kind: "circle";
	  };

export interface CollisionBody {
	readonly group: CollisionGroup;
	readonly id: string;
	readonly isTrigger: boolean;
	readonly mask: CollisionMask;
	readonly shape: CollisionShape;
}

export interface Hitbox {
	readonly body: CollisionBody;
	readonly damage: number;
}

export interface Hurtbox {
	readonly body: CollisionBody;
	readonly targetId: string;
}

const masksAllow = (mask: CollisionMask, group: CollisionGroup): boolean =>
	mask.length === 0 || mask.includes(group);

export const overlapsAabb = (left: Aabb, right: Aabb): boolean =>
	left.x < right.x + right.width &&
	left.x + left.width > right.x &&
	left.y < right.y + right.height &&
	left.y + left.height > right.y;

export const overlapsCircle = (left: Circle, right: Circle): boolean => {
	const dx = left.x - right.x;
	const dy = left.y - right.y;
	const radiusSum = left.radius + right.radius;

	return dx * dx + dy * dy <= radiusSum * radiusSum;
};

export const overlapsAabbCircle = (aabb: Aabb, circle: Circle): boolean => {
	const closestX = Math.max(aabb.x, Math.min(circle.x, aabb.x + aabb.width));
	const closestY = Math.max(aabb.y, Math.min(circle.y, aabb.y + aabb.height));
	const dx = circle.x - closestX;
	const dy = circle.y - closestY;

	return dx * dx + dy * dy <= circle.radius * circle.radius;
};

export const overlapsShape = (
	left: CollisionShape,
	right: CollisionShape,
): boolean => {
	if (left.kind === "aabb" && right.kind === "aabb") {
		return overlapsAabb(left.shape, right.shape);
	}

	if (left.kind === "circle" && right.kind === "circle") {
		return overlapsCircle(left.shape, right.shape);
	}

	if (left.kind === "aabb" && right.kind === "circle") {
		return overlapsAabbCircle(left.shape, right.shape);
	}

	if (left.kind === "circle" && right.kind === "aabb") {
		return overlapsAabbCircle(right.shape, left.shape);
	}

	return false;
};

export const tileIndex = (width: number, x: number, y: number): number =>
	y * width + x;

export const tileAt = (
	tiles: ReadonlyArray<number>,
	width: number,
	x: number,
	y: number,
): number | undefined => tiles[tileIndex(width, x, y)];

export const isSolidTileAt = (
	tiles: ReadonlyArray<number>,
	width: number,
	x: number,
	y: number,
	solidTileIds: ReadonlySet<number>,
): boolean => {
	const tile = tileAt(tiles, width, x, y);
	return tile !== undefined && solidTileIds.has(tile);
};

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
							masksAllow(mask, body.group) && overlapsShape(shape, body.shape),
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
					Effect.succeed(overlapsAabb(left, right)),
				overlapsCircle: (left: Circle, right: Circle) =>
					Effect.succeed(overlapsCircle(left, right)),
				queryOverlaps,
				collidesWithSolid,
				queryTriggers,
			});
		}),
	);
}
