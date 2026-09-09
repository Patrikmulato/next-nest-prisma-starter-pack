# Deployment Guide

This guide covers how to deploy GeoGuessr Helper to Vercel.

## Prerequisites

- GitHub account with the repository
- Vercel account (free at [vercel.com](https://vercel.com))
- No credit card required for hobby/personal projects

## One-Time Setup

### 1. Connect GitHub to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select "Import Git Repository"
3. Search for and select your `geoguessr-helper` repository
4. Click "Import"

### 2. Configure Build Settings (Vercel Dashboard)

The `vercel.json` file already contains the build configuration, so Vercel should detect it automatically.

Verify in the Vercel dashboard:

- **Framework**: Next.js
- **Root Directory**: (leave empty)
- **Build Command**: `pnpm install && pnpm build:backend && pnpm build`
- **Output Directory**: `.next`

### 3. Set Environment Variables (Vercel Dashboard)

Go to your Vercel project → Settings → Environment Variables and add:

```
NEXT_PUBLIC_API_BASE_URL=https://your-project.vercel.app/api
NODE_ENV=production
```

Optional for crawler tasks:

```
GUIDE_SOURCE_BASE_URL=<your-guide-source-url>
GUIDE_SOURCE_SITEMAP_URL=<optional-sitemap-url>
```

### 4. (Optional) Enable Automatic Deployments via GitHub Actions

If you want automatic deployments on successful CI:

1. Go to Vercel Account Settings → Tokens
2. Create a new token and copy it
3. Go to your GitHub repository → Settings → Secrets and variables → Actions
4. Add three secrets:
   - `VERCEL_TOKEN`: Your Vercel token
   - `VERCEL_ORG_ID`: Found in Vercel project settings
   - `VERCEL_PROJECT_ID`: Found in Vercel project settings

The `.github/workflows/deploy-vercel.yml` workflow will then deploy automatically on pushes to `main`.

## Deploying

### Option A: Manual Deploy (Default)

1. Push code to GitHub
2. Vercel automatically detects the push and builds
3. Visit your Vercel project dashboard to see the build status
4. Once successful, your site is live at `https://your-project.vercel.app`

### Option B: Deploy via GitHub Actions (If Configured)

1. Push code to GitHub
2. CI workflow runs (see `.github/workflows/ci.yml`)
3. On success, automatic deploy workflow runs (see `.github/workflows/deploy-vercel.yml`)
4. Vercel deploys the built artifacts

### Option C: Manual Trigger in Vercel Dashboard

1. Go to your Vercel project dashboard
2. Click "Redeploy" to trigger a new build

## URLs After Deployment

- **Frontend**: `https://your-project.vercel.app`
- **Backend API**: `https://your-project.vercel.app/api`
- **GeoJSON**: `https://your-project.vercel.app/api/data/geojson`
- **Map Data**: `https://your-project.vercel.app/api/data/map`
- **Filter**: `https://your-project.vercel.app/api/data/filter`

## Local Development with Vercel CLI (Optional)

To test production builds locally:

```bash
npm i -g vercel

# Run the Vercel dev server locally (mimics production)
vercel dev
```

## Troubleshooting

### Build fails

- Check that `pnpm build` works locally: `pnpm build && pnpm build:backend`
- Check Vercel build logs in the dashboard for specific errors
- Ensure all environment variables are set in Vercel

### API endpoints not working

- Verify `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Check that the backend is being built and included in the deployment
- Look at Vercel function logs in the dashboard

### Performance issues

- Check the Vercel Analytics dashboard
- Verify that GeoJSON and map data are being cached properly
- Consider using Vercel's KV Store for cache if needed

## Monitoring

- **Build logs**: Vercel dashboard → Deployments → click deployment
- **Runtime logs**: Vercel dashboard → Functions
- **Performance**: Vercel dashboard → Analytics
- **Errors**: Vercel dashboard → Monitor

## Vercel Serverless Hardening

This project stays on Vercel for backend hosting.

### Required backend secrets (Vercel)

Set these in Project Settings → Environment Variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Recommended:

- Use a pooled PostgreSQL URL for serverless traffic patterns.
- Keep preview and production env vars aligned.
- To bootstrap selected administrators without exposing a public promotion endpoint,
  set `ADMIN_EMAILS` to a comma-separated allowlist, for example
  `admin@example.com,another-admin@example.com`. Matching users become `ADMIN`
  when they register or next log in.

### Optional shared store (Upstash Redis)

Upstash is **optional in production**. When it is not configured, the shared
cache and rate limiter fall back to per-instance memory according to the outage
policy (fail-open by default).

Example free option:

- Upstash Redis (free tier)

To enable a shared store across serverless instances, add:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Outage policy (optional):

- `CACHE_OUTAGE_POLICY` — `fail-open` (default) or `fail-closed`
- `RATE_LIMIT_OUTAGE_POLICY` — `fail-open` (default) or `fail-closed`

Notes:

- With `fail-open`, requests continue using per-instance memory when Upstash is
  missing or unavailable. This is resilient but not shared across instances, so
  limits/caches are enforced per-instance.
- With `fail-closed`, the app requires a healthy Upstash connection and rejects
  affected requests when it is missing or unavailable.
- Serverless instances are stateless and can scale horizontally, so for strict
  global rate limiting prefer a shared store with `fail-closed`.
- Keep `/api/health` available for runtime checks.

## Rolling Back

To revert to a previous deployment:

1. Go to Vercel dashboard → Deployments
2. Find the deployment you want to revert to
3. Click the three dots and select "Promote to Production"
