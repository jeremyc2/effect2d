import { Effect, Layer } from "effect";
import {
	Audio,
	CollisionWorld,
	Cutscene,
	DebugOverlay,
	defaultEngineConfig,
	Engine,
	EngineLogger,
	Graphics,
	Input,
	MapRepository,
	makeRuntimeLayer,
	NativeBoundary,
	ResourceTracker,
	SceneDirector,
	SceneRegistry,
	Sequence,
	SequenceEvents,
	UI,
} from "../../../src/index.ts";
import { starterRooms } from "./content/StarterRooms.ts";
import { StarterCoordinator } from "./directors/StarterCoordinator.ts";
import { StarterGameplayDirector } from "./directors/StarterGameplayDirector.ts";
import { StarterPresentationDirector } from "./directors/StarterPresentationDirector.ts";
import { starterBindings } from "./input/StarterBindings.ts";
import { StarterSaveParticipants } from "./save/StarterSaveParticipants.ts";
import { MainMenuScene } from "./scenes/MainMenuScene.ts";
import { OverworldScene } from "./scenes/OverworldScene.ts";
import { PauseOverlayScene } from "./scenes/PauseOverlayScene.ts";
import { DebugSettingsState } from "./state/DebugSettingsState.ts";
import { DialogueState } from "./state/DialogueState.ts";
import { GameplayState } from "./state/GameplayState.ts";
import { PlayerState } from "./state/PlayerState.ts";
import { RoomState } from "./state/RoomState.ts";
import { WorldState } from "./state/WorldState.ts";

export const starterConfig = {
	...defaultEngineConfig,
	gameId: "Effect2d/starter",
	randomSeed: "starter-seed",
	startScene: "main-menu",
	targetTicksPerSecond: 60,
};

export const starterNativeBoundaryLayer = Layer.effect(NativeBoundary)(
	Effect.succeed(
		NativeBoundary.of({
			diagnostics: Effect.succeed({
				audio: {
					activeSoundCount: 0,
					backend: "headless",
					currentMusicCueId: null,
					supportsLoopingMusic: false,
					supportsPauseResume: false,
					supportsPitch: false,
					supportsVolume: false,
				},
				initialized: false,
				inputEventCount: 0,
				lastError: null,
				renderer: {
					backend: "headless",
					frameCount: 0,
					supportsBlendModes: ["alpha"],
					supportsImages: false,
					supportsText: false,
				},
				timing: {
					backend: "headless",
					frameDelayMillis: 0,
				},
				window: null,
			}),
			initialize: () => Effect.void,
			shutdown: Effect.void,
		}),
	),
);

const starterRuntimeLayer = makeRuntimeLayer(starterConfig, {
	nativeBoundaryLayer: starterNativeBoundaryLayer,
});

const starterStateLayer = Layer.mergeAll(
	DebugSettingsState.layer,
	DialogueState.layer,
	GameplayState.layer,
	PlayerState.layer,
	WorldState.layer,
);

const starterEngineCapabilityLayer = Layer.mergeAll(
	Audio.layer,
	CollisionWorld.layer,
	EngineLogger.layer,
	Graphics.layer,
	Input.layer,
	ResourceTracker.layer,
	starterRuntimeLayer,
);

const starterCapabilityLayer = Layer.mergeAll(
	starterEngineCapabilityLayer,
	starterStateLayer,
);

const starterUILayer = UI.layer.pipe(Layer.provide(starterCapabilityLayer));

const starterMapRepositoryLayer = MapRepository.layer(starterRooms);

const starterRoomStateLayer = RoomState.layer.pipe(
	Layer.provide(Layer.mergeAll(starterMapRepositoryLayer, starterStateLayer)),
);

const starterSceneRegistryLayer = SceneRegistry.layer([
	MainMenuScene,
	OverworldScene,
	PauseOverlayScene,
]);

const starterSceneDirectorLayer = SceneDirector.layer(
	starterConfig.startScene,
).pipe(Layer.provide(starterSceneRegistryLayer));

const starterDebugOverlayLayer = DebugOverlay.layer.pipe(
	Layer.provide(
		Layer.mergeAll(starterCapabilityLayer, starterSceneDirectorLayer),
	),
);

const starterSequenceLayer = Sequence.layer.pipe(
	Layer.provide(
		Layer.mergeAll(starterEngineCapabilityLayer, starterSceneDirectorLayer),
	),
);

const starterCutsceneLayer = Cutscene.layer.pipe(
	Layer.provide(Layer.mergeAll(starterSequenceLayer, starterUILayer)),
);

const starterSaveParticipantsLayer = StarterSaveParticipants.layer.pipe(
	Layer.provide(starterStateLayer),
);

const starterCoordinatorLayer = StarterCoordinator.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			starterCapabilityLayer,
			starterMapRepositoryLayer,
			starterRoomStateLayer,
			SequenceEvents.layer,
			starterStateLayer,
		),
	),
);

const starterGameplayDirectorLayer = StarterGameplayDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			starterCapabilityLayer,
			starterCutsceneLayer,
			SequenceEvents.layer,
			starterSequenceLayer,
			starterSceneDirectorLayer,
			starterRoomStateLayer,
			starterUILayer,
			starterDebugOverlayLayer,
		),
	),
);

const starterPresentationDirectorLayer = StarterPresentationDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			starterCapabilityLayer,
			starterDebugOverlayLayer,
			starterSceneDirectorLayer,
			starterRoomStateLayer,
			starterUILayer,
		),
	),
);

export const StarterGameLive = Layer.mergeAll(
	starterCapabilityLayer,
	starterCoordinatorLayer,
	starterDebugOverlayLayer,
	starterGameplayDirectorLayer,
	starterMapRepositoryLayer,
	starterPresentationDirectorLayer,
	starterRoomStateLayer,
	starterSceneDirectorLayer,
	starterSceneRegistryLayer,
	starterSequenceLayer,
	starterCutsceneLayer,
	starterUILayer,
	SequenceEvents.layer,
	starterSaveParticipantsLayer,
);

export const starterBootstrap = Effect.gen(function* () {
	const audio = yield* Audio;
	const debugOverlay = yield* DebugOverlay;
	const debugSettingsState = yield* DebugSettingsState;
	const engineLogger = yield* EngineLogger;
	const input = yield* Input;
	const starterCoordinator = yield* StarterCoordinator;
	const starterSaveParticipants = yield* StarterSaveParticipants;
	const ui = yield* UI;

	yield* starterCoordinator.beginNewGame;
	yield* input.setBindings(starterBindings);
	yield* audio.loadMusic({
		cueId: "starter-theme",
		defaultLoop: true,
		defaultPitch: 1,
		defaultVolume: 0.7,
		sourcePath: "games/starter/audio/music/starter-theme.ogg",
	});
	yield* audio.loadSound({
		cueId: "menu-confirm",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.7,
		sourcePath: "games/starter/audio/sfx/menu-confirm.wav",
	});
	yield* audio.loadSound({
		cueId: "pause-toggle",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.6,
		sourcePath: "games/starter/audio/sfx/pause-toggle.wav",
	});
	yield* audio.loadSound({
		cueId: "pickup-lantern",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.8,
		sourcePath: "games/starter/audio/sfx/pickup-lantern.wav",
	});
	yield* audio.loadSound({
		cueId: "room-transition",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.75,
		sourcePath: "games/starter/audio/sfx/room-transition.wav",
	});
	yield* audio.loadSound({
		cueId: "slime-hit",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.8,
		sourcePath: "games/starter/audio/sfx/slime-hit.wav",
	});
	yield* audio.playMusic("starter-theme", { loop: true });
	yield* ui.loadFont({
		fontId: "ui-body",
		glyphWidth: 8,
		lineHeight: 12,
		sourcePath: "games/starter/fonts/ui-body.ttf",
	});

	const debugSettings = yield* debugSettingsState.snapshot;
	if (debugSettings.debugOverlayEnabled) {
		yield* debugOverlay.enable;
	}

	yield* starterCoordinator.recordSceneChange(starterConfig.startScene);
	yield* starterCoordinator.processEvents;

	const saveParticipants = yield* starterSaveParticipants.all;
	yield* engineLogger.info("Starter game bootstrapped.", {
		saveParticipantCount: saveParticipants.length,
		startScene: starterConfig.startScene,
	});
});

export const starterProgram = Effect.gen(function* () {
	const engine = yield* Engine;
	yield* starterBootstrap;
	yield* engine.launch();
});
