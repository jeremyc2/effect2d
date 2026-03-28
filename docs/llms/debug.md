# Debug

> Public Debug API.

## EngineLogger

### InvalidLogMessageError

- Kind: error
- Source: `src/debug/EngineLogger.ts:29`

Indicates that a log call received an invalid message payload.

## ResourceTracker

### InvalidResourceRecordError

- Kind: error
- Source: `src/debug/ResourceTracker.ts:28`

Indicates that a tracked resource record was missing required data.

### UnknownTrackedResourceError

- Kind: error
- Source: `src/debug/ResourceTracker.ts:37`

Indicates that code referenced a tracked resource id that has not been registered.