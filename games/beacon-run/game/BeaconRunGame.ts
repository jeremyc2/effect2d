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
	NativeBoundary,
	ResourceTracker,
	SceneDirector,
	SceneRegistry,
	Script,
	ScriptEvents,
	Ui,
} from "../../../src/index.ts";
import { beaconRunRooms } from "./content/BeaconRunRooms.ts";
import { BeaconRunCoordinator } from "./directors/BeaconRunCoordinator.ts";
import { BeaconRunGameplayDirector } from "./directors/BeaconRunGameplayDirector.ts";
import { BeaconRunPresentationDirector } from "./directors/BeaconRunPresentationDirector.ts";
import { beaconRunBindings } from "./input/BeaconRunBindings.ts";
import { BeaconRunSaveParticipants } from "./save/BeaconRunSaveParticipants.ts";
import { FieldScene } from "./scenes/FieldScene.ts";
import { PauseScene } from "./scenes/PauseScene.ts";
import { TitleScene } from "./scenes/TitleScene.ts";
import { BeaconRunRoomState } from "./state/BeaconRunRoomState.ts";
import { ExpeditionState } from "./state/ExpeditionState.ts";
import { ScoutState } from "./state/ScoutState.ts";

export const beaconRunConfig = {
	...defaultEngineConfig,
	gameId: "effect2d/beacon-run",
	randomSeed: "beacon-run-seed",
	startScene: "title",
	targetTicksPerSecond: 60,
};

export const beaconRunNativeBoundaryLayer = Layer.effect(NativeBoundary)(
	Effect.succeed(
		NativeBoundary.of({
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

const beaconRunUiLayer = Ui.layer.pipe(Layer.provide(beaconRunCapabilityLayer));

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

const beaconRunScriptLayer = Script.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			beaconRunEngineCapabilityLayer,
			beaconRunSceneDirectorLayer,
			beaconRunUiLayer,
		),
	),
);

const beaconRunCoordinatorLayer = BeaconRunCoordinator.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			beaconRunCapabilityLayer,
			beaconRunRoomStateLayer,
			ScriptEvents.layer,
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
			beaconRunScriptLayer,
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
				beaconRunUiLayer,
			),
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
	beaconRunScriptLayer,
	beaconRunUiLayer,
	ScriptEvents.layer,
	beaconRunSaveParticipantsLayer,
);

export const beaconRunBootstrap = Effect.gen(function* () {
	const audio = yield* Audio;
	const beaconRunCoordinator = yield* BeaconRunCoordinator;
	const beaconRunSaveParticipants = yield* BeaconRunSaveParticipants;
	const engineLogger = yield* EngineLogger;
	const input = yield* Input;
	const ui = yield* Ui;

	yield* beaconRunCoordinator.beginExpedition;
	yield* input.setBindings(beaconRunBindings);
	yield* audio.loadMusic({
		cueId: "beacon-run-theme",
		defaultLoop: true,
		defaultPitch: 1,
		defaultVolume: 0.7,
		sourcePath: "games/beacon-run/audio/music/beacon-run-theme.ogg",
	});
	yield* audio.loadSound({
		cueId: "menu-confirm",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.7,
		sourcePath: "games/beacon-run/audio/sfx/menu-confirm.wav",
	});
	yield* audio.loadSound({
		cueId: "pause-toggle",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.6,
		sourcePath: "games/beacon-run/audio/sfx/pause-toggle.wav",
	});
	yield* audio.loadSound({
		cueId: "room-transition",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.75,
		sourcePath: "games/beacon-run/audio/sfx/room-transition.wav",
	});
	yield* audio.loadSound({
		cueId: "beacon-ignite",
		defaultLoop: false,
		defaultPitch: 1,
		defaultVolume: 0.8,
		sourcePath: "games/beacon-run/audio/sfx/beacon-ignite.wav",
	});
	yield* audio.playMusic("beacon-run-theme", { loop: true });
	yield* ui.loadFont({
		fontId: "ui-body",
		glyphWidth: 8,
		lineHeight: 12,
		sourcePath: "games/beacon-run/fonts/ui-body.ttf",
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
