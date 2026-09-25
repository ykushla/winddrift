# Wind Drift v0.8

Static, mobile-first wind-correction prototype designed for later deployment on GitHub Pages.

## v0.8 changes

- Intermediate coordinates are shown side-by-side for faster field reading.
- In `%` mode, the percentage and calculated distance in metres are both large and on the same line.
- In `м` mode, the entered distance and calculated percentage are both large and on the same line.
- Calculation logic is unchanged from v0.7.


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
