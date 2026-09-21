<img src="public/logo-mark.svg" alt="" width="72" align="right">

# hatidsuki-frontend

Web app for Hatid Suki, an ordering tool for small food and retail businesses. Staff use it to manage items, build order forms, share QR codes and work through incoming orders. Customers use it, without an account, to order after scanning a QR code. The backend is in the `hatidsuki-backend` repository.

Angular 21 with standalone components, signals and Bootstrap 5.

## Running it locally

You need Node 22 and the API running on http://localhost:5168.

```bash
npm install --legacy-peer-deps
npx ng serve
```

Open http://localhost:4200. The dev server forwards `/api` to the API (see `proxy.conf.json`), so login cookies work the same way as in production. The API's demo data includes an owner login, `demo@hatidsuki.local` with the password `HatidSuki1!`, and a customer page at `/q/demo2026`.

`--legacy-peer-deps` is needed because of an npm resolver bug with the current Angular packages.

## Building

```bash
npm run build
```

The output is in `dist/hatidsuki-frontend/browser`.

## Deploying

The app is deployed on Vercel. `vercel.json` sets the build, sends `/api/...` to the API on Railway, and adds the security headers. Before the first deploy, put the API's Railway address in the rewrite there (it currently reads `YOUR-API.up.railway.app`). Full steps are in the `hatidsuki-backend` repository, in `docs/architecture/deployment.md`.

## Brand

The logo, favicon set and colour notes are described in [docs/brand.md](docs/brand.md).

## Layout

```
src/app/core       auth, API client, HTTP interceptor, shared types
src/app/shared     item picker, location picker, dialog
src/app/features   sign in, board, orders, items, forms, delivery, dashboard, settings, customer pages
```
