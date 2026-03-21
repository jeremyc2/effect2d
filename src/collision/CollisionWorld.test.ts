import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import {
	type CollisionBody,
	type CollisionShape,
	CollisionWorld,
	isSolidTileAt,
	tileAt,
} from "./CollisionWorld.ts";

describe("CollisionWorld", () => {
	test("detects solid overlaps and trigger queries", async () => {
		const playerShape: CollisionShape = {
			kind: "aabb",
			shape: {
				height: 16,
				width: 16,
				x: 8,
				y: 8,
			},
		};

		const wallBody: CollisionBody = {
			group: "wall",
			id: "wall-1",
			isTrigger: false,
			mask: [],
			shape: {
				kind: "aabb",
				shape: {
					height: 16,
					width: 16,
					x: 12,
					y: 8,
				},
			},
		};

		const triggerBody: CollisionBody = {
			group: "transition",
			id: "transition-1",
			isTrigger: true,
			mask: [],
			shape: {
				kind: "circle",
				shape: {
					radius: 10,
					x: 16,
					y: 16,
				},
			},
		};

		await runLayerEffect(
			CollisionWorld.layer,
			Effect.gen(function* () {
				const collisionWorld = yield* CollisionWorld;

				yield* collisionWorld.registerBody(wallBody);
				yield* collisionWorld.registerBody(triggerBody);

				expect(
					yield* collisionWorld.collidesWithSolid(playerShape, ["wall"]),
				).toBe(true);

				const triggers = yield* collisionWorld.queryTriggers(playerShape, [
					"transition",
				]);
				expect(triggers.map((body) => body.id)).toEqual(["transition-1"]);
			}),
		);
	});

	test("supports tile lookups for room-based collision", () => {
		const tiles = [0, 1, 2, 3];
		const solidTileIds = new Set([1, 3]);

		expect(tileAt(tiles, 2, 1, 0)).toBe(1);
		expect(tileAt(tiles, 2, 0, 3)).toBeUndefined();
		expect(isSolidTileAt(tiles, 2, 1, 0, solidTileIds)).toBe(true);
		expect(isSolidTileAt(tiles, 2, 0, 0, solidTileIds)).toBe(false);
	});
});
