# Forma project rules

## Product

Forma is a local-first JSON dataset viewer. The browser owns file reading and
record navigation. An optional server-side LLM may return a declarative layout
blueprint; model output is never executable code.

## Stack and commands

- React 19, TypeScript 5, Next-compatible vinext, Tailwind CSS 4
- Dev: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`
- Build: `npm run build`

## Conventions

- Use named exports for reusable components and utilities.
- Keep data parsing and layout inference as pure functions under `app/lib/`.
- Colocate unit tests with pure logic using `*.test.ts`.
- Treat JSON files and LLM responses as untrusted input.
- Render user data through React text nodes; never use `dangerouslySetInnerHTML`.
- Only render layout kinds and field roles declared by the `LayoutBlueprint`
  contract.

## Boundaries

- Always validate model output and cap file/model payload sizes.
- Ask before adding persistence, authentication, or a new external provider.
- Never commit secrets, execute model-authored code, or upload the full dataset
  to the model endpoint.

## Component pattern

```tsx
type PanelProps = { title: string; children: React.ReactNode };

export function Panel({ title, children }: PanelProps) {
  return (
    <section aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`}>{title}</h2>
      {children}
    </section>
  );
}
```
