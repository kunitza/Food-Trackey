# Food Trackey

Mobile-first food/macro tracker. React 18 + Vite + Firebase (Auth + Firestore) + Tailwind. Deployed on Vercel.

## Stack

- **Build**: Vite 5, React 18, JavaScript (not TypeScript)
- **Routing**: react-router-dom v6
- **State/data**: Firebase Auth + Firestore (client SDK, with IndexedDB offline persistence)
- **Food data**: Open Food Facts (no key) + USDA FoodData Central (`VITE_USDA_API_KEY`)
- **Charts**: recharts
- **Barcode**: jsqr (camera-based)

## Repo layout

```
src/
  App.jsx              # router, splash, ForceHomeOnLoad wrapper
  main.jsx             # entrypoint
  firebase.js          # Firebase init + offline persistence
  contexts/AuthContext.jsx
  components/          # Layout, ProtectedRoute, BarcodeScanner, MacroBar, SettingsModal
  pages/               # Today, Lookup, History, Weight, Login, Signup
  hooks/useFirestore.js
  utils/               # foodApi.js, macros.js, timezone.js
public/                # icons, manifest.json
```

## Commands

```bash
npm run dev       # vite dev server, http://localhost:5173
npm run build     # vite build → dist/
npm run preview   # preview built output
```

## Deploy flow

- GitHub: https://github.com/kunitza/Food-Trackey (branch `main`)
- Vercel auto-deploys on push to `main` → https://vercel.com/kunitzas-projects/food-trackey
- `vercel.json` rewrites everything to `/` for client-side routing (SPA fallback)

## Environment

- `.env.local` pulled from Vercel via `vercel env pull .env.local` — do not commit
- All vars must be `VITE_` prefixed to be exposed to the client
- Firebase project: `food-tracker-bbb36`

## Conventions observed in codebase

- Plain JSX, no TypeScript
- Tailwind for styling; no CSS-in-JS except inline `<style>` blocks for keyframes
- No test framework configured
- Files were historically uploaded in bulk (commit history is "Add files via upload") — prefer real commits going forward
