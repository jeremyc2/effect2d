import { Effect, Layer } from "effect";
import {
	Audio,
	defaultEngineConfig,
	Engine,
	EngineLogger,
	Graphics,
	Input,
	makeSkiaNativeBoundaryLayer,
	RandomSource,
	ResourceTracker,
	RuntimeClock,
	SceneCamera,
	SceneDirector,
	SceneLookup,
	UI,
} from "../../../src/index.ts";
import { makeHeadlessNativeBoundaryLayer } from "../../../src/testing/index.ts";
import { CavernGameplayDirector } from "./directors/CavernGameplayDirector.ts";
import { CavernPresentationDirector } from "./directors/CavernPresentationDirector.ts";
import { cavernBindings } from "./input/CavernBindings.ts";
import { CavernFrameUpdaterLive } from "./native/CavernFrameUpdater.ts";
import {
	CavernDiskSave,
	cavernPlatformIoLayer,
	cavernSaveCoordinatorLayer,
} from "./save/cavernAutosave.ts";
import { CavernMainMenuScene } from "./scenes/CavernMainMenuScene.ts";
import { CavernOverworldScene } from "./scenes/CavernOverworldScene.ts";
import { CavernEnemyState } from "./state/CavernEnemyState.ts";
import { CavernMenuState } from "./state/CavernMenuState.ts";
import { CavernPlayerState } from "./state/CavernPlayerState.ts";
import { CavernWorldState } from "./state/CavernWorldState.ts";

export const cavernConfig = {
	...defaultEngineConfig,
	gameId: "Effect2d/cavern",
	randomSeed: "cavern-seed",
	startScene: "main-menu",
	targetTicksPerSecond: 60,
};

export const cavernNativeBoundaryLayer = makeHeadlessNativeBoundaryLayer();

const cavernCoreStateLayer = Layer.mergeAll(
	CavernEnemyState.layer,
	CavernPlayerState.layer,
	CavernWorldState.layer,
);

/** Save coordinator reads the live service map; build it after core state layers. */
const cavernSaveLayer = cavernSaveCoordinatorLayer.pipe(
	Layer.provideMerge(cavernCoreStateLayer),
);

const cavernBaseStateLayer = Layer.mergeAll(
	CavernMenuState.layer,
	cavernSaveLayer,
);

const cavernStateLayer = Layer.mergeAll(
	cavernBaseStateLayer,
	CavernDiskSave.layer.pipe(
		Layer.provide(Layer.mergeAll(cavernPlatformIoLayer, cavernBaseStateLayer)),
	),
);

const cavernRuntimeSupportLayer = Layer.mergeAll(
	RandomSource.layer(cavernConfig.randomSeed),
	RuntimeClock.layer(cavernConfig.targetTicksPerSecond),
);

const cavernCapabilityLayer = Layer.mergeAll(
	Audio.layer,
	cavernPlatformIoLayer,
	EngineLogger.layer,
	Graphics.layer,
	Input.layer,
	ResourceTracker.layer,
	SceneCamera.layer(),
	cavernRuntimeSupportLayer,
	cavernStateLayer,
);

const cavernUILayer = UI.layer.pipe(Layer.provide(cavernCapabilityLayer));

const cavernSceneLookupLayer = SceneLookup.layer([
	CavernMainMenuScene,
	CavernOverworldScene,
]);

const cavernSceneDirectorLayer = SceneDirector.layer({
	startSceneId: cavernConfig.startScene,
}).pipe(Layer.provide(cavernSceneLookupLayer));

const cavernGameplayDirectorLayer = CavernGameplayDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(cavernCapabilityLayer, cavernSceneDirectorLayer),
	),
);

const cavernPresentationDirectorLayer = CavernPresentationDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			cavernCapabilityLayer,
			cavernSceneDirectorLayer,
			cavernUILayer,
		),
	),
);

const cavernFrameUpdaterLayer = CavernFrameUpdaterLive.pipe(
	Layer.provide(
		Layer.mergeAll(
			cavernGameplayDirectorLayer,
			cavernPresentationDirectorLayer,
		),
	),
);

export const cavernPlayableNativeBoundaryLayer = makeSkiaNativeBoundaryLayer({
	defaultFontFamily: "RussoOne",
	defaultFontPath: "games/cavern/assets/fonts/RussoOne-Regular.ttf",
	defaultFontSizePx: 48,
	fontAssetDefinitions: {
		"intro-font": {
			family: "VT323",
			sizePx: 42,
			sourcePath: "games/cavern/assets/fonts/VT323-Regular.ttf",
		},
		"menu-button": {
			family: "RussoOne",
			sizePx: 48,
			sourcePath: "games/cavern/assets/fonts/RussoOne-Regular.ttf",
		},
		"menu-message": {
			family: "RussoOne",
			sizePx: 32,
			sourcePath: "games/cavern/assets/fonts/RussoOne-Regular.ttf",
		},
		"menu-title": {
			family: "RussoOne",
			sizePx: 146,
			sourcePath: "games/cavern/assets/fonts/RussoOne-Regular.ttf",
		},
	},
	imageAssetPaths: {
		"environment-bg": "games/cavern/assets/images/environment/bg.png",
		"environment-wall": "games/cavern/assets/images/environment/wall.png",
		"enemy-flyer-body": "games/cavern/assets/images/enemies/flyerBody.png",
		"enemy-flyer-eye": "games/cavern/assets/images/enemies/flyerEye.png",
		"enemy-flyer-wing-1": "games/cavern/assets/images/enemies/flyerWing1.png",
		"enemy-flyer-wing-2": "games/cavern/assets/images/enemies/flyerWing2.png",
		"icon-github": "games/cavern/assets/images/ui/github.png",
		"icon-sound": "games/cavern/assets/images/ui/sound.png",
		"player-new": "games/cavern/assets/images/player/newPlayer.png",
	},
	logicalHeight: 768,
	logicalWidth: 1152,
	preferIntegerScaling: false,
	resizable: true,
	title: "CAVERN",
	windowHeight: 960,
	windowWidth: 1440,
}).pipe(
	Layer.provide(Layer.mergeAll(cavernCapabilityLayer, cavernFrameUpdaterLayer)),
);

const cavernHeadlessEngineLayer = Engine.layer(cavernConfig).pipe(
	Layer.provide(cavernNativeBoundaryLayer),
);

const cavernPlayableEngineLayer = Engine.layer(cavernConfig).pipe(
	Layer.provide(cavernPlayableNativeBoundaryLayer),
);

const cavernSharedGameLayer = Layer.mergeAll(
	cavernCapabilityLayer,
	cavernGameplayDirectorLayer,
	cavernPresentationDirectorLayer,
	cavernSceneDirectorLayer,
	cavernSceneLookupLayer,
	cavernUILayer,
);

export const CavernLive = Layer.mergeAll(
	cavernSharedGameLayer,
	cavernHeadlessEngineLayer,
);

export const CavernPlayableLive = Layer.mergeAll(
	cavernSharedGameLayer,
	cavernPlayableEngineLayer,
	cavernPlayableNativeBoundaryLayer,
);

export const cavernBootstrap = Effect.gen(function* () {
	const audio = yield* Audio;
	const input = yield* Input;
	const ui = yield* UI;

	yield* input.setBindings(cavernBindings);
	yield* audio.loadMusic({
		cueId: "cavern-menu",
		defaultLoop: true,
		defaultPitch: 1,
		defaultVolume: 0.7,
		sourcePath: "games/cavern/assets/music/menu.ogg",
	});
	yield* audio.loadSound({
		cueId: "menu-click",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.8,
		sourcePath: "games/cavern/assets/audio/sfx/ui/click.wav",
	});
	yield* ui.loadFont({
		fontId: "intro-font",
		glyphWidth: 20,
		lineHeight: 34,
		sourcePath: "games/cavern/assets/fonts/VT323-Regular.ttf",
	});
	yield* ui.loadFont({
		fontId: "menu-message",
		glyphWidth: 18,
		lineHeight: 28,
		sourcePath: "games/cavern/assets/fonts/RussoOne-Regular.ttf",
	});
	yield* audio.playMusic("cavern-menu", { loop: true });
});

export const cavernProgram = Effect.gen(function* () {
	const engine = yield* Engine;
	const cavernDiskSave = yield* CavernDiskSave;
	yield* cavernBootstrap;
	yield* cavernDiskSave.loadFromDisk();
	yield* engine.launch();
});
