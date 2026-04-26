import { describe, expect, test } from "bun:test";
import { Effect, Layer, Ref } from "effect";

import { Audio } from "../audio/Audio.ts";
import { Input } from "../input/Input.ts";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { FrameUpdater } from "./FrameUpdater.ts";
import { NativeBoundary } from "./NativeBoundary.ts";
import { PlatformBackend } from "./PlatformBackend.ts";

describe("NativeBoundary", () => {
	test("orchestrates backend input, audio sync, frame presentation, and shutdown", () => {
		const providerLayer = Layer.mergeAll(
			Audio.layer,
			Input.layer,
			Layer.effect(FrameUpdater)(
				Effect.succeed(
					FrameUpdater.of({
						nextFrame: Effect.succeed({
							commands: [],
							isOpen: false,
							transformDepth: 0,
						}),
					}),
				),
			),
			Layer.effect(PlatformBackend)(
				Effect.gen(function* () {
					const presentedFrames = yield* Ref.make(0);
					const syncedAudio = yield* Ref.make(0);
					const openRef = yield* Ref.make(false);

					return PlatformBackend.of({
						close: Ref.set(openRef, false),
						diagnostics: Ref.get(openRef).pipe(
							Effect.map((initialized) => ({
								audio: {
									activeSoundCount: 0,
									backend: "test",
									currentMusicCueId: null,
									supportsLoopingMusic: false,
									supportsPauseResume: false,
									supportsPitch: false,
									supportsVolume: false,
								},
								initialized,
								inputEventCount: 0,
								lastError: null,
								renderer: {
									backend: "test",
									frameCount: 0,
									supportsBlendModes: ["alpha"],
									supportsImages: true,
									supportsText: true,
								},
								timing: {
									backend: "test",
									frameDelayMillis: 0,
								},
								window: initialized
									? {
											backend: "test",
											height: 10,
											isOpen: true,
											pixelHeight: 10,
											pixelWidth: 10,
											title: "test",
											width: 10,
										}
									: null,
							})),
						),
						drainInputEvents: Effect.succeed([
							{
								key: "Enter",
								type: "key-down" as const,
							},
						]),
						open: () => Ref.set(openRef, true),
						presentFrame: () =>
							Ref.update(presentedFrames, (count) => count + 1),
						syncAudio: () =>
							Ref.update(syncedAudio, (count) => count + 1).pipe(Effect.as([])),
						waitForNextFrame: Ref.set(openRef, false),
					});
				}),
			),
		);

		return runLayerEffect(
			Layer.mergeAll(
				providerLayer,
				NativeBoundary.layer.pipe(Layer.provide(providerLayer)),
			),
			Effect.gen(function* () {
				const audio = yield* Audio;
				const input = yield* Input;
				const nativeBoundary = yield* NativeBoundary;

				yield* audio.loadSound({
					cueId: "confirm",
					defaultLoop: false,
					defaultPitch: 1,
					defaultVolume: 1,
					sourcePath: "games/cavern/assets/audio/sfx/ui/click.wav",
				});
				yield* audio.playSfx("confirm");
				yield* nativeBoundary.initialize("effect2d/test-native");

				expect(yield* input.isKeyPressed("Enter")).toBe(true);
				expect((yield* nativeBoundary.diagnostics).initialized).toBe(false);
			}),
		);
	});
});
