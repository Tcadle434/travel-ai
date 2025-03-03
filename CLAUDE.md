# CLAUDE.md - Travel AI App Guide

## Commands
- Build all: `pnpm build`
- Dev mode: `pnpm dev`
- Lint all: `pnpm lint`
- Type check: `pnpm check-types`
- Format code: `pnpm format`
- Docker: `pnpm docker:up` / `pnpm docker:down`

### API Gateway (NestJS)
- Run tests: `cd apps/api-gateway && pnpm test`
- Run single test: `cd apps/api-gateway && pnpm test -- -t "test name"`
- E2E tests: `cd apps/api-gateway && pnpm test:e2e`

### Web App (Next.js)
- Dev: `cd apps/web && pnpm dev`
- Lint: `cd apps/web && pnpm lint`

## Code Style Guidelines
- TypeScript: Use strict typing with explicit return types
- Naming: camelCase for variables/methods, PascalCase for classes/interfaces
- Files: `.ts` for logic, `.tsx` for React components
- Tests: `.spec.ts` suffix for unit tests
- Imports: Group by external, internal, relative paths
- Error handling: Use try/catch with specific error types
- Components: Prefer functional components with TypeScript interfaces
- State: Type all state variables and props