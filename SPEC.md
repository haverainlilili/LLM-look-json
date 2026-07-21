# Spec: Forma dynamic dataset viewer

## Objective

Build a clean, general local-first web application that opens `.json`,
`.jsonl`, and `.ndjson` files and turns records into human-readable views.
The stable application framework owns file parsing, navigation, filtering,
schema inspection, and rendering. A configurable LLM analyzes a bounded schema
and record sample and returns a safe declarative layout blueprint.

Primary users are dataset builders and reviewers who need to understand data
without reading raw JSON. Success means an unfamiliar supported file can be
opened, analyzed, and browsed without writing code.

## Product behavior

- Start with a realistic built-in conversation dataset so the product is useful
  before a file is selected.
- Accept local JSON/JSONL/NDJSON through a file picker or drag and drop.
- Keep the original dataset in the browser. Send at most five truncated sample
  records plus inferred schema to the optional model endpoint.
- Discover record arrays at the root or common nested paths such as `data`,
  `records`, `items`, `rows`, `results`, and `samples`.
- Infer field paths, types, presence rate, and representative values.
- Offer conversation, comparison, gallery, table, cards, and raw renderers.
- Use a local heuristic blueprint immediately. The user can request an AI
  blueprint when the server is configured.
- Allow search, renderer switching, record paging, schema browsing, raw record
  inspection, and blueprint inspection.
- Surface invalid files and model failures as recoverable, human-readable
  states.

## Layout contract

The model returns JSON only:

```ts
type LayoutKind =
  | "conversation"
  | "comparison"
  | "gallery"
  | "table"
  | "cards";

type FieldRole =
  | "title"
  | "subtitle"
  | "body"
  | "badge"
  | "media"
  | "meta"
  | "messages"
  | "chosen"
  | "rejected";

interface LayoutBlueprint {
  version: 1;
  title: string;
  description: string;
  kind: LayoutKind;
  fields: Array<{ path: string; label: string; role: FieldRole }>;
  rationale: string;
}
```

Unknown kinds, roles, oversized strings, excessive fields, and paths absent
from the inferred schema are discarded. The renderer never accepts HTML,
JavaScript, CSS, component names, URLs to fetch, or executable expressions.

## API

`POST /api/analyze`

Request: `{ fileName, schema, samples }` with server-enforced size limits.

Success: `{ data: LayoutBlueprint, meta: { source: "model" } }`

Errors: `{ error: { code, message } }` with consistent 4xx/5xx status codes.

Configuration remains server-side:

- `LLM_API_URL`: OpenAI-compatible chat-completions endpoint
- `LLM_API_KEY`: provider credential
- `LLM_MODEL`: configured model name

## Threat model

Trust boundaries are the local file, the analyze HTTP request, the configured
model provider, and model output. Main abuse cases are oversized files/payloads,
prompt injection embedded in dataset text, model-authored markup/code, secret
exposure, and unbounded model cost.

Controls: local file cap, sample and string truncation, request-size checks,
server-only secrets, fixed provider URL from environment, timeout, bounded
tokens, explicit prompt instruction that samples are data, strict blueprint
validation, React escaping, and no dynamic HTML/code execution.

## Tech stack and structure

- `app/components/`: focused client UI components and renderers
- `app/lib/`: parsing, schema inference, search, blueprint contract/validation
- `app/api/analyze/`: optional model integration
- `tests/`: rendered application integration test
- `tasks/`: implementation plan and checklist

## Commands

- Dev: `npm run dev`
- Unit tests: `npm run test:unit`
- Full test: `npm test`
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`
- Build: `npm run build`

## Testing strategy

- Unit-test parsing, record discovery, schema inference, heuristic selection,
  search, and hostile/invalid blueprint handling with Node's test runner.
- Build and render the application worker to verify product metadata and the
  server-rendered application shell.
- Runtime-check the local development endpoint and analyze error semantics.

## Boundaries

- Always: keep data local by default, validate every external boundary, keep
  keyboard-accessible controls, test behavior before implementation.
- Ask first: persistence, authentication, remote file import, new dependencies,
  or provider-specific SDKs.
- Never: execute generated code, render generated HTML, expose API keys, send
  the entire dataset to the model, or silently fetch URLs found in records.

## Success criteria

- Opening valid JSON or JSONL produces records and an inferred schema.
- Conversation and preference samples receive useful specialized views; generic
  records remain readable through table/cards/raw views.
- The UI is responsive from 320px through large desktop screens and all actions
  use native keyboard-focusable controls.
- With no model configuration the local analysis remains fully usable.
- With configuration the API returns only a validated `LayoutBlueprint`.
- Unit tests, lint, type checking, build, and rendered integration tests pass.

## Assumptions

- First release is a browser application optimized for files up to 20 MB, not a
  multi-gigabyte desktop viewer.
- No account, persistence, collaboration, or deployment is required for the
  first local version.
- The model provider offers an OpenAI-compatible chat-completions JSON API.

## Open questions

None block the first version. Provider-specific adapters and large-file
streaming are deliberate follow-up work.
