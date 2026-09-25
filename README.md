# Wind Drift v0.6

Static, mobile-first wind-correction prototype designed for later deployment on GitHub Pages.

## v0.6 changes

- Ukrainian UI.
- Shooter and target endpoints are fixed semantic points and no longer expose `%/m` selectors.
- Endpoint positions are shown as plain distances with labels "Дистанція стрільця" and "Дистанція цілі".
- Intermediate position controls are narrower so `%/м` selectors fit on small screens.
- Wind direction dial supports tap **and drag** with 0.5-hour increments.
- Minimal `+` button for adding wind points.
- Numeric inputs trim redundant leading zeros while preserving values such as `0.5`.
- Blue visual theme retained.
- Static relative paths remain compatible with GitHub Pages.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by the server.

## Test

```bash
npm test
```

## GitHub Pages

Publish the `main` branch from `/ (root)` in **Settings → Pages**. The root `index.html` redirects to `./public/`.

## v0.6.2 cache strategy

GitHub Pages runtime assets are published under a physical versioned path:
`public/assets/v0.6.2/`.

This intentionally avoids query-string cache busting. Each release gets a new asset directory, so Safari receives new CSS/JavaScript URLs while HTML is requested with revalidation hints.
