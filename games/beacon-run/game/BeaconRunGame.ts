import { Effect, Layer } from "effect";
import {
	Audio,
	CollisionWorld,
	DebugOverlay,
	defaultEngineConfig,
	Engine,
	EngineLogger,
	Graphics,
	Input,
	MapRepository,
	makeRuntimeLayer,
	makeSkiaNativeBoundaryLayer,
	NativeBoundary,
	ResourceTracker,
	SceneDirector,
	SceneRegistry,
	Sequence,
	SequenceEvents,
	UI,
} from "../../../src/index.ts";
import { beaconRunRooms } from "./content/BeaconRunRooms.ts";
import { BeaconRunCoordinator } from "./directors/BeaconRunCoordinator.ts";
import { BeaconRunGameplayDirector } from "./directors/BeaconRunGameplayDirector.ts";
import { BeaconRunPresentationDirector } from "./directors/BeaconRunPresentationDirector.ts";
import { beaconRunBindings } from "./input/BeaconRunBindings.ts";
import { BeaconRunNativeFrameSourceLive } from "./native/BeaconRunNativeFrameSource.ts";
import { BeaconRunSaveParticipants } from "./save/BeaconRunSaveParticipants.ts";
import { FieldScene } from "./scenes/FieldScene.ts";
import { PauseScene } from "./scenes/PauseScene.ts";
import { TitleScene } from "./scenes/TitleScene.ts";
import { BeaconRunRoomState } from "./state/BeaconRunRoomState.ts";
import { ExpeditionState } from "./state/ExpeditionState.ts";
import { ScoutState } from "./state/ScoutState.ts";

export const beaconRunConfig = {
	...defaultEngineConfig,
	gameId: "Effect2d/beacon-run",
	randomSeed: "beacon-run-seed",
	startScene: "title",
	targetTicksPerSecond: 60,
};

export const beaconRunNativeBoundaryLayer = Layer.effect(NativeBoundary)(
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

const beaconRunRuntimeLayer = makeRuntimeLayer(beaconRunConfig, {
	nativeBoundaryLayer: beaconRunNativeBoundaryLayer,
});

const beaconRunStateLayer = Layer.mergeAll(
	ExpeditionState.layer,
	ScoutState.layer,
);

const beaconRunEngineCapabilityLayer = Layer.mergeAll(
	Audio.layer,
	CollisionWorld.layer,
	EngineLogger.layer,
	Graphics.layer,
	Input.layer,
	ResourceTracker.layer,
	beaconRunRuntimeLayer,
);

const beaconRunCapabilityLayer = Layer.mergeAll(
	beaconRunEngineCapabilityLayer,
	beaconRunStateLayer,
);

const beaconRunUILayer = UI.layer.pipe(Layer.provide(beaconRunCapabilityLayer));

const beaconRunMapRepositoryLayer = MapRepository.layer(beaconRunRooms);

const beaconRunRoomStateLayer = BeaconRunRoomState.layer.pipe(
	Layer.provide(
		Layer.mergeAll(beaconRunMapRepositoryLayer, beaconRunStateLayer),
	),
);

const beaconRunSceneRegistryLayer = SceneRegistry.layer([
	TitleScene,
	FieldScene,
	PauseScene,
]);

const beaconRunSceneDirectorLayer = SceneDirector.layer(
	beaconRunConfig.startScene,
).pipe(Layer.provide(beaconRunSceneRegistryLayer));

const beaconRunDebugOverlayLayer = DebugOverlay.layer.pipe(
	Layer.provide(
		Layer.mergeAll(beaconRunCapabilityLayer, beaconRunSceneDirectorLayer),
	),
);

const beaconRunSequenceLayer = Sequence.layer.pipe(
	Layer.provide(
		Layer.mergeAll(beaconRunEngineCapabilityLayer, beaconRunSceneDirectorLayer),
	),
);

const beaconRunCoordinatorLayer = BeaconRunCoordinator.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			beaconRunCapabilityLayer,
			beaconRunRoomStateLayer,
			SequenceEvents.layer,
		),
	),
);

const beaconRunGameplayDirectorLayer = BeaconRunGameplayDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			beaconRunCapabilityLayer,
			beaconRunDebugOverlayLayer,
			beaconRunRoomStateLayer,
			beaconRunSceneDirectorLayer,
			beaconRunSequenceLayer,
		),
	),
);

const beaconRunPresentationDirectorLayer =
	BeaconRunPresentationDirector.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				beaconRunCapabilityLayer,
				beaconRunRoomStateLayer,
				beaconRunSceneDirectorLayer,
				beaconRunUILayer,
			),
		),
	);

const beaconRunNativeFrameSourceLayer = BeaconRunNativeFrameSourceLive.pipe(
	Layer.provide(
		Layer.mergeAll(
			beaconRunGameplayDirectorLayer,
			beaconRunPresentationDirectorLayer,
		),
	),
);

export const beaconRunPlayableNativeBoundaryLayer = makeSkiaNativeBoundaryLayer(
	{
		defaultFontPath: "games/beacon-run/assets/fonts/ui-body.ttf",
		defaultFontSizePx: 16,
		imageAssetPaths: {
			"beacon-lit": "games/beacon-run/assets/images/beacon-lit.png",
			"beacon-unlit": "games/beacon-run/assets/images/beacon-unlit.png",
			"field-room-background":
				"games/beacon-run/assets/images/field-room-background.png",
			"scout-idle": "games/beacon-run/assets/images/scout-idle.png",
			"shrine-room-background":
				"games/beacon-run/assets/images/shrine-room-background.png",
			"title-screen": "games/beacon-run/assets/images/title-screen.png",
		},
		logicalHeight: 192,
		logicalWidth: 256,
		resizable: true,
		title: "Effect2d: Beacon Run",
		windowHeight: 768,
		windowWidth: 1024,
	},
).pipe(
	Layer.provide(
		Layer.mergeAll(beaconRunCapabilityLayer, beaconRunNativeFrameSourceLayer),
	),
);

const beaconRunSaveParticipantsLayer = BeaconRunSaveParticipants.layer.pipe(
	Layer.provide(beaconRunStateLayer),
);

export const BeaconRunLive = Layer.mergeAll(
	beaconRunCapabilityLayer,
	beaconRunCoordinatorLayer,
	beaconRunDebugOverlayLayer,
	beaconRunGameplayDirectorLayer,
	beaconRunMapRepositoryLayer,
	beaconRunPresentationDirectorLayer,
	beaconRunRoomStateLayer,
	beaconRunSceneDirectorLayer,
	beaconRunSceneRegistryLayer,
	beaconRunSequenceLayer,
	beaconRunUILayer,
	SequenceEvents.layer,
	beaconRunSaveParticipantsLayer,
);

export const BeaconRunPlayableLive = Layer.mergeAll(
	BeaconRunLive,
	beaconRunPlayableNativeBoundaryLayer,
);

export const beaconRunBootstrap = Effect.gen(function* () {
	const audio = yield* Audio;
	const beaconRunCoordinator = yield* BeaconRunCoordinator;
	const beaconRunSaveParticipants = yield* BeaconRunSaveParticipants;
	const engineLogger = yield* EngineLogger;
	const input = yield* Input;
	const ui = yield* UI;

	yield* beaconRunCoordinator.beginExpedition;
	yield* input.setBindings(beaconRunBindings);
	yield* audio.loadMusic({
		cueId: "beacon-run-theme",
		defaultLoop: true,
		defaultPitch: 1,
		defaultVolume: 0.7,
		sourcePath: "games/beacon-run/assets/audio/music/beacon-run-theme.mp3",
	});
	yield* audio.loadSound({
		cueId: "menu-confirm",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.7,
		sourcePath: "games/beacon-run/assets/audio/sfx/menu-confirm.wav",
	});
	yield* audio.loadSound({
		cueId: "pause-toggle",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.6,
		sourcePath: "games/beacon-run/assets/audio/sfx/pause-toggle.wav",
	});
	yield* audio.loadSound({
		cueId: "room-transition",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.75,
		sourcePath: "games/beacon-run/assets/audio/sfx/room-transition.wav",
	});
	yield* audio.loadSound({
		cueId: "beacon-ignite",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.8,
		sourcePath: "games/beacon-run/assets/audio/sfx/beacon-ignite.wav",
	});
	yield* audio.playMusic("beacon-run-theme", { loop: true });
	yield* ui.loadFont({
		fontId: "ui-body",
		glyphWidth: 12,
		lineHeight: 18,
		sourcePath: "games/beacon-run/assets/fonts/ui-body.ttf",
	});
	yield* beaconRunCoordinator.recordSceneChange(beaconRunConfig.startScene);
	yield* beaconRunCoordinator.processEvents;

	const saveParticipants = yield* beaconRunSaveParticipants.all;
	yield* engineLogger.info("Beacon Run bootstrapped.", {
		saveParticipantCount: saveParticipants.length,
		startScene: beaconRunConfig.startScene,
	});
});

export const beaconRunProgram = Effect.gen(function* () {
	const engine = yield* Engine;
	yield* beaconRunBootstrap;
	yield* engine.launch();
});

export const playableBeaconRunProgram = Effect.gen(function* () {
	const nativeBoundary = yield* NativeBoundary;
	yield* beaconRunBootstrap;
	yield* nativeBoundary.initialize(beaconRunConfig.gameId);
});
