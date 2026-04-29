# GearUp

P2P gear rental marketplace for Hyderabad, built with Vite + React + Firebase.
Originally migrated from a Vercel/v0 Next.js export.

## Stack

- **Framework**: Vite 7 + React 19
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`) + shadcn/ui (Radix primitives)
- **Routing**: wouter
- **Auth + Data**: Firebase (Auth + Firestore) — config in `artifacts/gearup/src/lib/firebase.ts`
- **Animation**: framer-motion / motion
- **QR**: html5-qrcode + qrcode.react
- **Node.js**: 24
- **Package manager**: pnpm (single-package workspace)

## Project layout

```
.
├── artifacts/gearup/         ← the app (Vite + React)
│   ├── src/                  ← all app source
│   ├── public/               ← static assets (favicon, opengraph)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── package.json              ← workspace root with shortcut scripts
├── pnpm-workspace.yaml       ← lists only `artifacts/gearup`
├── tsconfig.base.json
├── tsconfig.json
└── vercel.json               ← Vercel deployment config
```

The app lives under `artifacts/gearup/` because Replit's preview pane requires
that location. The root `package.json` exposes `pnpm dev` / `pnpm build` /
`pnpm preview` / `pnpm typecheck` shortcuts that delegate to the gearup package.

## Local development (Replit or local)

```bash
pnpm install
pnpm dev          # starts Vite on PORT (defaults to 5173)
```

Replit runs `pnpm --filter @workspace/gearup run dev` automatically via its
configured workflow. The preview pane is mapped to the dev server port.

## Production build

```bash
pnpm build        # outputs to artifacts/gearup/dist/public/
pnpm preview      # serves the build locally for verification
```

## Vercel deployment

`vercel.json` at the repo root tells Vercel:

- Install with `pnpm install`
- Build with `pnpm --filter @workspace/gearup run build`
- Serve from `artifacts/gearup/dist/public`
- Inject `BASE_PATH=/` and `PORT=5173` at build time
- Rewrite all unmatched paths to `/index.html` for SPA client-side routing

Just import the repo into Vercel and it will pick up `vercel.json` automatically.

## Environment variables

Firebase credentials are currently hardcoded in `src/lib/firebase.ts`
(inherited from the original Vercel/v0 export — these are public web client
keys, which is normal for Firebase).
