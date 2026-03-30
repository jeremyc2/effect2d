import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { Audio } from "./Audio.ts";

describe("Audio", () => {
	test("loads cues, plays music, overlaps sound effects, and snapshots audio state", async () => {
		await runLayerEffect(
			Audio.layer,
			Effect.gen(function* () {
				const audio = yield* Audio;

				yield* audio.loadMusic({
					cueId: "overworld-theme",
					defaultLoop: true,
					defaultPitch: 1,
					defaultVolume: 0.8,
					sourcePath: "audio/music/overworld.ogg",
				});
				yield* audio.loadSound({
					cueId: "sword-hit",
					defaultLoop: false,
					defaultPitch: 1,
					defaultVolume: 0.6,
					sourcePath: "audio/sfx/sword-hit.wav",
				});

				yield* audio.playMusic("overworld-theme", { loop: true });
				const firstHit = yield* audio.playSfx("sword-hit");
				const secondHit = yield* audio.playSfx("sword-hit", {
					pitch: 1.2,
					volume: 0.4,
				});
				yield* audio.setBusVolume("music", 0.5);

				const snapshot = yield* audio.snapshot;

				expect((yield* audio.loadedCues).map((cue) => cue.cueId)).toEqual([
					"overworld-theme",
					"sword-hit",
				]);
				expect(snapshot.music).toEqual({
					cueId: "overworld-theme",
					loop: true,
					paused: false,
					pitch: 1,
					volume: 0.8,
				});
				expect(snapshot.sounds.map((sound) => sound.playbackId)).toEqual([
					firstHit,
					secondHit,
				]);
				expect(snapshot.sounds[1]?.pitch).toBe(1.2);
				expect(snapshot.busVolumes.music).toBe(0.5);
			}),
		);
	});

	test("supports pausing music and stopping individual sound handles", async () => {
		await runLayerEffect(
			Audio.layer,
			Effect.gen(function* () {
				const audio = yield* Audio;

				yield* audio.loadMusic({
					cueId: "boss-theme",
					defaultLoop: true,
					defaultPitch: 1,
					defaultVolume: 1,
					sourcePath: "audio/music/boss.ogg",
				});
				yield* audio.loadSound({
					cueId: "menu-confirm",
					defaultLoop: false,
					defaultPitch: 1,
					defaultVolume: 0.9,
					sourcePath: "audio/sfx/menu-confirm.wav",
				});

				yield* audio.playMusic("boss-theme");
				const playbackId = yield* audio.playSfx("menu-confirm");
				yield* audio.pauseMusic;
				expect((yield* audio.music)?.paused).toBe(true);

				yield* audio.resumeMusic;
				expect((yield* audio.music)?.paused).toBe(false);

				yield* audio.stopSound(playbackId);
				expect(yield* audio.sounds).toHaveLength(0);

				yield* audio.stopAll;
				expect(yield* audio.music).toBeNull();
			}),
		);
	});

	test("fails when the wrong cue kind is played", async () => {
		const exit = await runLayerEffect(
			Audio.layer,
			Effect.gen(function* () {
				const audio = yield* Audio;

				yield* audio.loadSound({
					cueId: "explosion",
					defaultLoop: false,
					defaultPitch: 1,
					defaultVolume: 1,
					sourcePath: "audio/sfx/explosion.wav",
				});

				return yield* Effect.exit(audio.playMusic("explosion"));
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
	});
});
