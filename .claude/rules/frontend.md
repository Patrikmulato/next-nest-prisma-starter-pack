---
description: Frontend rules for src/** files
globs: src/**
---

- Never store access tokens or refresh tokens in `localStorage` or other frontend-readable storage — access token lives in `accessTokenRef` inside `AuthProvider`
- Always call the backend through typed wrappers in `src/lib/api/` — never call `fetch` directly in page components
- Protected pages must redirect to `/login` when `status === 'unauthenticated'`; admin pages must also redirect to `/` when `!isAdmin`
- Use Tailwind utility classes for styling; custom CSS goes in `src/app/globals.css` only when Tailwind can't cover it
- Dark theme is the default — background `#181c22`, cards `#20262e`
- `FilterDropdown` is a generic viewport-aware dropdown component; it is not wired to any specific data source
- New pages requiring authentication should follow the `useEffect` redirect pattern in `app/members/page.tsx`
