# Frontend — Quick Reference

Next.js 16 App Router + TypeScript + Tailwind v4. Auth state managed by `AuthProvider` via JWT access token (in-memory) + HttpOnly refresh cookie.

## Key Files

| File                            | Role                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `app/page.tsx`                  | Landing page — hero, about, services, contact sections           |
| `app/layout.tsx`                | Root layout — wraps with Navbar and AuthProvider                 |
| `app/login/page.tsx`            | Login page using AuthForm                                        |
| `app/register/page.tsx`         | Register page using AuthForm                                     |
| `app/members/page.tsx`          | Protected members area (redirects unauthenticated users)         |
| `app/members/[slug]/page.tsx`   | Protected content page by slug                                   |
| `app/admin/users/page.tsx`      | Admin-only user management                                       |
| `components/Navbar.tsx`         | Auth-aware navigation bar with user role indicator               |
| `components/AuthForm.tsx`       | Reusable login/register form with error handling                 |
| `components/FilterDropdown.tsx` | Generic viewport-aware dropdown                                  |
| `lib/api/client.ts`             | `ApiClient` class (GET/POST/PUT/DELETE, Bearer auth, 401 retry)  |
| `lib/api/auth.ts`               | Typed wrappers for auth endpoints                                |
| `lib/api/users.ts`              | Typed wrappers for user management endpoints                     |
| `lib/auth/AuthProvider.tsx`     | Auth context — in-memory access token, HttpOnly refresh cookie   |
| `types/auth.ts`                 | AuthUser, AuthResponse, AuthCredentials types                    |
| `types/user.ts`                 | User type for admin panel                                        |
| `config/index.ts`               | `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3001`) |
| `app/globals.css`               | Global styles — custom CSS goes here only                        |

## Rules

- Never store access tokens or refresh tokens in `localStorage` or other frontend-readable storage
- Always call the backend through typed wrappers in `src/lib/api/` — never call `fetch` directly in page components
- Protected pages must redirect to `/login` when `status === 'unauthenticated'`
- Admin pages must also redirect to `/` when `!isAdmin`
- Styling: Tailwind classes first; `globals.css` only when Tailwind can't cover it
- Dark theme is the default — background `#181c22`, cards `#20262e`
- New pages requiring authentication should follow the `useEffect` redirect pattern in `members/page.tsx`

## Auth Data Flow

```
AuthProvider (on mount)
  → POST /api/auth/refresh (restore session from HttpOnly cookie)
  → setUser + status = 'authenticated' OR status = 'unauthenticated'

login / register
  → POST /api/auth/login or /api/auth/register
  → accessToken stored in memory (accessTokenRef in AuthProvider)
  → refresh token in HttpOnly cookie (set by backend)

API requests
  → apiClient attaches Bearer token from accessTokenRef
  → on 401: single refresh attempt, then retry

logout
  → POST /api/auth/logout
  → clear local session state (token + user)
```
