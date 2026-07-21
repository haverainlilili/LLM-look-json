# Forma task list

- [ ] Task 1: Core dataset analysis
  - Acceptance: JSON/JSONL parsing, record discovery, schema inference, search,
    and local blueprint selection are tested.
  - Verify: `npm run test:unit` and `npx tsc --noEmit`.
  - Files: `app/lib/*`, `package.json`.

- [ ] Task 2: Safe model analysis API
  - Acceptance: bounded requests reach only the configured endpoint; response
    blueprints are validated; errors use one documented shape.
  - Verify: unit tests and `npm run build`.
  - Files: `app/api/analyze/route.ts`, `app/lib/blueprint.ts`.

- [ ] Task 3: Dynamic dataset workspace
  - Acceptance: file drop, schema, search, navigation, specialized renderers,
    raw view, and AI re-analysis work with the built-in sample.
  - Verify: `npm run build` and manual local endpoint check.
  - Files: `app/components/*`, `app/page.tsx`, `app/globals.css`.

- [ ] Task 4: Product hardening and handoff
  - Acceptance: responsive/accessible states, product metadata, docs, security
    audit, and rendered HTML checks are complete.
  - Verify: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm audit`.
  - Files: `app/layout.tsx`, `tests/*`, `README.md`, task docs.
