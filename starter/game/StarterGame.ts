import { Effect, Layer } from "effect";
import {
	Audio,
	DebugOverlay,
	defaultEngineConfig,
	Engine,
	EngineLogger,
	Graphics,
	Input,
	makeRuntimeLayer,
	NativeBoundary,
	ResourceTracker,
	SceneDirector,
	SceneRegistry,
	Script,
	ScriptEvents,
	Ui,
} from "../../src/index.ts";
import { StarterCoordinator } from "./directors/StarterCoordinator.ts";
import { StarterGameplayDirector } from "./directors/StarterGameplayDirector.ts";
import { starterBindings } from "./input/StarterBindings.ts";
import { StarterSaveParticipants } from "./save/StarterSaveParticipants.ts";
import { MainMenuScene } from "./scenes/MainMenuScene.ts";
import { OverworldScene } from "./scenes/OverworldScene.ts";
import { PauseOverlayScene } from "./scenes/PauseOverlayScene.ts";
import { DebugSettingsState } from "./state/DebugSettingsState.ts";
import { GameplayState } from "./state/GameplayState.ts";
import { PlayerState } from "./state/PlayerState.ts";
import { WorldState } from "./state/WorldState.ts";

export const starterConfig = {
	...defaultEngineConfig,
	gameId: "effect2d/starter",
	randomSeed: "starter-seed",
	startScene: "main-menu",
	targetTicksPerSecond: 60,
};

export const starterNativeBoundaryLayer = Layer.effect(NativeBoundary)(
	Effect.succeed(
		NativeBoundary.of({
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
	GameplayState.layer,
	PlayerState.layer,
	WorldState.layer,
);

const starterEngineCapabilityLayer = Layer.mergeAll(
	Audio.layer,
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

const starterUiLayer = Ui.layer.pipe(Layer.provide(starterCapabilityLayer));

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

const starterScriptLayer = Script.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			starterEngineCapabilityLayer,
			starterSceneDirectorLayer,
			starterUiLayer,
		),
	),
);

const starterSaveParticipantsLayer = StarterSaveParticipants.layer.pipe(
	Layer.provide(starterStateLayer),
);

const starterCoordinatorLayer = StarterCoordinator.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			starterCapabilityLayer,
			ScriptEvents.layer,
			starterStateLayer,
		),
	),
);

const starterGameplayDirectorLayer = StarterGameplayDirector.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			starterCapabilityLayer,
			ScriptEvents.layer,
			starterStateLayer,
			starterUiLayer,
			starterDebugOverlayLayer,
			starterScriptLayer,
		),
	),
);

export const StarterGameLive = Layer.mergeAll(
	starterCapabilityLayer,
	starterCoordinatorLayer,
	starterDebugOverlayLayer,
	starterGameplayDirectorLayer,
	starterSceneDirectorLayer,
	starterSceneRegistryLayer,
	starterScriptLayer,
	starterUiLayer,
	ScriptEvents.layer,
	starterSaveParticipantsLayer,
);

export const starterBootstrap = Effect.gen(function* () {
	const debugOverlay = yield* DebugOverlay;
	const debugSettingsState = yield* DebugSettingsState;
	const engineLogger = yield* EngineLogger;
	const input = yield* Input;
	const starterCoordinator = yield* StarterCoordinator;
	const starterGameplayDirector = yield* StarterGameplayDirector;
	const starterSaveParticipants = yield* StarterSaveParticipants;
	const ui = yield* Ui;

	yield* starterCoordinator.beginNewGame;
	yield* input.setBindings(starterBindings);
	yield* ui.loadFont({
		fontId: "ui-body",
		glyphWidth: 8,
		lineHeight: 12,
		sourcePath: "starter/fonts/ui-body.ttf",
	});

	const debugSettings = yield* debugSettingsState.snapshot;
	if (debugSettings.debugOverlayEnabled) {
		yield* debugOverlay.enable;
	}

	yield* starterCoordinator.recordSceneChange(starterConfig.startScene);
	yield* starterCoordinator.processEvents;
	yield* starterGameplayDirector.runIntroSequence();

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
