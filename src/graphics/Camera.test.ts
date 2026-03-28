import { describe, expect, test } from "bun:test";
import {
	followCameraTarget,
	getScreenPositionFromWorld,
	getWorldPositionFromScreen,
	makeCameraState,
	setCameraBounds,
	setCameraPosition,
	setCameraZoom,
	startCameraShake,
	updateCameraFollow,
	updateCameraShake,
} from "./Camera.ts";

describe("Camera", () => {
	test("maps world coordinates into screen coordinates", () => {
		const camera = setCameraZoom(
			makeCameraState({
				position: { x: 10, y: 20 },
				viewport: { height: 180, width: 320 },
			}),
			2,
		);

		expect(getScreenPositionFromWorld(camera, { x: 20, y: 30 })).toEqual({
			x: 180,
			y: 110,
		});
		expect(getWorldPositionFromScreen(camera, { x: 180, y: 110 })).toEqual({
			x: 20,
			y: 30,
		});
	});

	test("clamps camera position to bounds", () => {
		const bounded = setCameraPosition(
			setCameraBounds(makeCameraState(), {
				maxX: 50,
				maxY: 40,
				minX: -20,
				minY: -10,
			}),
			{ x: 100, y: -30 },
		);

		expect(bounded.position).toEqual({
			x: 50,
			y: -10,
		});
	});

	test("follows a target and keeps that target clamped to bounds", () => {
		const followed = updateCameraFollow(
			followCameraTarget(
				setCameraBounds(makeCameraState(), {
					maxX: 30,
					maxY: 30,
					minX: 0,
					minY: 0,
				}),
				{ x: 100, y: 20 },
			),
		);

		expect(followed.position).toEqual({
			x: 30,
			y: 20,
		});
	});

	test("advances and expires camera shake over time", () => {
		const shaken = startCameraShake(makeCameraState(), 6, 1);
		const midShake = updateCameraShake(shaken, 0.5);
		const finishedShake = updateCameraShake(midShake, 0.5);

		expect(midShake.shake).not.toBeNull();
		expect(finishedShake.shake).toBeNull();
	});
});
