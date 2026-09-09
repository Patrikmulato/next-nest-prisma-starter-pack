---
description: TypeScript best practices and type safety standards
globs: **/*.ts
---

## ❌ Never Use `any` Type

`any` defeats TypeScript's type safety. Always use these alternatives:

### When You Don't Know the Type

```typescript
// ❌ WRONG
function process(data: any) {}

// ✅ RIGHT - Use unknown (requires type guard)
function process(data: unknown) {}
```

### When Type is Complex or External

```typescript
// ❌ WRONG
const corsConfig: any = { ... };

// ✅ RIGHT - Use unknown or type guard
const corsConfig: unknown = { ... };
// Then validate before using:
if (corsConfig && typeof corsConfig === 'object') { ... }
```

### When You Need Flexible Types

```typescript
// ❌ WRONG
type AppConfig = {
  options?: any;
};

// ✅ RIGHT - Use unknown
type AppConfig = {
  options?: unknown;
};
```

## Type Safety Guidelines

| Scenario                   | Type                       | Why                                        |
| -------------------------- | -------------------------- | ------------------------------------------ |
| Don't know the type        | `unknown`                  | Forces type narrowing before use           |
| Can be anything            | `unknown`                  | Safe default, requires validation          |
| Object with unknown shape  | `Record<string, unknown>`  | Explicit object with unknown values        |
| Type needs assertion       | `as SomeType` + type guard | Explicit intent, not hidden like `any`     |
| Response from external lib | `unknown` + interface      | Define your own interface matching the lib |

## Exception: External Library Boundaries

**Only use `any` at library boundaries with explicit ESLint disable:**

```typescript
// Type assertion: Fastify CORS types are strict about origin function signature,
// but our implementation works correctly at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.enableCors(corsOptions as any);
```

### When to Exception:

- ✅ At external library boundary (Fastify, NestJS, external SDK)
- ✅ TypeScript's types don't match your correct implementation
- ✅ You have explicitly documented WHY
- ✅ Runtime behavior is tested and verified

### Never Use `any`:

- ❌ For internal application code
- ❌ Without explicit `@typescript-eslint/no-explicit-any` eslint-disable
- ❌ Without a comment explaining the external lib mismatch

## Applied Standards in This Project

- ✅ All filter types: `unknown` (not `any`)
- ✅ All interceptor types: properly typed
- ✅ CORS setup: `NestFastifyApplication` with justified `as any` at boundary
- ✅ Error handling: explicitly typed (never `any`)
- ✅ API responses: `{ success: true; data: T; timestamp: string; path: string }`

## References

- [TypeScript Handbook: Unknown and Never](https://www.typescriptlang.org/docs/handbook/2/unknown-and-never.html)
- [Type Guards and Narrowing](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html#type-guards-and-differentiating-types)
- [ESLint Rule: no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any/)
