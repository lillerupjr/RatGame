# Agent Command Output

Prefer compact scripts for routine verification. Use `npm --silent run` to avoid echoing long command lines:

- `npm --silent run test -- <optional vitest filters>` instead of `npx vitest run ...`
- `npm --silent run typecheck` instead of `npx tsc --noEmit`
- `npm --silent run build` instead of `vite build` or `npm run build:verbose`

Use verbose scripts only when the compact summary is not enough:

- `npm run test:verbose`
- `npm run typecheck:verbose`
- `npm run build:verbose`
