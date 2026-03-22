import { Effect, Layer } from "effect";
import {
	Audio,
	defaultEngineConfig,
	Engine,
	EngineLogger,
	Graphics,
	Input,
	makeRuntimeLayer,
	makeSdlCanvasNativeBoundaryLayer,
	NativeBoundary,
	ResourceTracker,
	SceneDirector,
	SceneRegistry,
} from "../../../src/index.ts";
import { CavernGameplayDirector } from "./directors/CavernGameplayDirector.ts";
import { CavernPresentationDirector } from "./directors/CavernPresentationDirector.ts";
import { cavernBindings } from "./input/CavernBindings.ts";
import { CavernNativeFrameSourceLive } from "./native/CavernNativeFrameSource.ts";
import { CavernMainMenuScene } from "./scenes/CavernMainMenuScene.ts";
import { CavernOverworldScene } from "./scenes/CavernOverworldScene.ts";
import { CavernMenuState } from "./state/CavernMenuState.ts";
import { CavernPlayerState } from "./state/CavernPlayerState.ts";

export const cavernConfig = {
	...defaultEngineConfig,
	gameId: "effect2d/cavern",
	randomSeed: "cavern-seed",
	startScene: "main-menu",
	targetTicksPerSecond: 60,
};

export const cavernNativeBoundaryLayer = Layer.effect(NativeBoundary)(
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

const cavernRuntimeLayer = makeRuntimeLayer(cavernConfig, {
	nativeBoundaryLayer: cavernNativeBoundaryLayer,
});

const cavernStateLayer = Layer.mergeAll(
	CavernMenuState.layer,
	CavernPlayerState.layer,
);

const cavernCapabilityLayer = Layer.mergeAll(
	Audio.layer,
	EngineLogger.layer,
	Graphics.layer,
	Input.layer,
	ResourceTracker.layer,
	cavernRuntimeLayer,
	cavernStateLayer,
);

const cavernSceneRegistryLayer = SceneRegistry.layer([
	CavernMainMenuScene,
	CavernOverworldScene,
]);

const cavernSceneDirectorLayer = SceneDirector.layer(
	cavernConfig.startScene,
).pipe(Layer.provide(cavernSceneRegistryLayer));

const cavernGameplayDirectorLayer = CavernGameplayDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(cavernCapabilityLayer, cavernSceneDirectorLayer),
	),
);

const cavernPresentationDirectorLayer = CavernPresentationDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(cavernCapabilityLayer, cavernSceneDirectorLayer),
	),
);

const cavernNativeFrameSourceLayer = CavernNativeFrameSourceLive.pipe(
	Layer.provide(
		Layer.mergeAll(
			cavernGameplayDirectorLayer,
			cavernPresentationDirectorLayer,
		),
	),
);

export const cavernPlayableNativeBoundaryLayer =
	makeSdlCanvasNativeBoundaryLayer({
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
			"icon-github": "games/cavern/assets/images/ui/github.png",
			"icon-sound": "games/cavern/assets/images/ui/sound.png",
			"player-new": "games/cavern/assets/images/player/newPlayer.png",
		},
		logicalHeight: 768,
		logicalWidth: 1152,
		resizable: false,
		title: "CAVERN",
		windowHeight: 768,
		windowWidth: 1152,
	}).pipe(
		Layer.provide(
			Layer.mergeAll(cavernCapabilityLayer, cavernNativeFrameSourceLayer),
		),
	);

export const CavernLive = Layer.mergeAll(
	cavernCapabilityLayer,
	cavernGameplayDirectorLayer,
	cavernPresentationDirectorLayer,
	cavernSceneDirectorLayer,
	cavernSceneRegistryLayer,
);

export const CavernPlayableLive = Layer.mergeAll(
	CavernLive,
	cavernPlayableNativeBoundaryLayer,
);

export const cavernBootstrap = Effect.gen(function* () {
	const audio = yield* Audio;
	const input = yield* Input;

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
	yield* audio.playMusic("cavern-menu", { loop: true });
});

export const cavernProgram = Effect.gen(function* () {
	const engine = yield* Engine;
	yield* cavernBootstrap;
	yield* engine.launch();
});

export const playableCavernProgram = Effect.gen(function* () {
	const nativeBoundary = yield* NativeBoundary;
	yield* cavernBootstrap;
	yield* nativeBoundary.initialize(cavernConfig.gameId);
});
