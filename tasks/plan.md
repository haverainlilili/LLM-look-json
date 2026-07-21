# Implementation Plan: Forma

## Overview

Build the product in four vertical slices: contract and core analysis, safe
model integration, interactive browsing UI, and final hardening/verification.

## Architecture decisions

- Use a fixed renderer library plus a validated blueprint DSL. This gives the
  model freedom to compose a view without giving it code execution.
- Keep file parsing and heuristic analysis client-side. Only a small redacted
  sample crosses the optional model boundary.
- Use pure TypeScript functions and Node tests for the risky data logic.
- Use the existing vinext starter and no new runtime dependency.

## Dependency graph

`parser -> inferred schema -> blueprint contract -> renderers -> workspace UI`

`blueprint contract -> analyze API -> AI re-analysis action`

## Phases

### Phase 1: Foundation

- Contract, tests, parser, schema inference, local blueprint selection.
- Checkpoint: unit tests and type checking pass.

### Phase 2: Model boundary

- Validated `/api/analyze` route with limits, timeout, structured errors, and
  OpenAI-compatible configuration.
- Checkpoint: unit tests and build pass.

### Phase 3: Product UI

- File drop, schema rail, record canvas, safe renderers, raw/blueprint panel,
  search and navigation, responsive/adaptive layout.
- Checkpoint: realistic sample works end to end.

### Phase 4: Hardening

- Product metadata/docs, rendered integration test, lint, type check, build,
  dependency audit, and local runtime checks.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Model returns malformed or hostile output | High | Strict allowlist validator and local fallback |
| Dataset embeds prompt injection | High | Treat samples as data; code-enforced output contract |
| Browser stalls on large file | Medium | 20 MB cap in v1 and visible explanation |
| Generic data looks poor | Medium | Always preserve table, cards, and raw fallback views |
| External provider unavailable | Medium | Local blueprint loads immediately and remains usable |

## Open questions

Provider-specific adapters and streaming files larger than 20 MB are deferred.
