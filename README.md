# Wind Drift

Mobile-first wind correction calculator driven by Applied Ballistics Range Card CSV exports.

## v0.5

This version adds the first field-oriented UI while keeping the calculation core separate.

### Current features

- Applied Ballistics CSV import in the browser.
- Automatic selection of the strongest usable AB wind calibration.
- Wind sensitivity normalized by the calibration wind's crosswind component.
- Target distance input.
- Wind control points at fixed percentages or fixed distances.
- 0% and 100% endpoint wind points are always present.
- Linear and PCHIP wind interpolation selectable on the main screen.
- McCoy/Litz segment weighting.
- Live result in MRAD with L/R side.
- No server-side code and no runtime dependencies.

## Applied Ballistics export requirement

Generate the Range Card with **Spin Drift, Coriolis and other non-wind horizontal corrections disabled**. The imported Windage columns must represent wind drift only.

The app can import left- or right-wind tables and arbitrary wind speed. It chooses the stronger usable wind solution and converts it to an absolute crosswind sensitivity.

## Run locally

Requires Node.js only:

```bash
npm run dev
```

Then open:

```text
http://localhost:8080/public/
```

Run tests:

```bash
npm test
```

## GitHub Pages

The repository is intentionally static and uses relative paths.

For the simplest deployment:

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder.
5. Save.

The root `index.html` redirects to `./public/`, so the Pages project URL opens the application automatically.

No build step is required.

## Structure

```text
src/
  core/       calculation engine and AB parser
  ui/         browser UI and state
  storage/    reserved for IndexedDB profile storage
public/
  index.html
  styles.css
  icons/
tests/
samples/
scripts/
README.md
package.json
index.html    GitHub Pages entry redirect
```

## Planned next

- IndexedDB profile persistence.
- Profile management screen.
- Remember last wind field and interpolation model.
- PWA manifest and service worker for offline installation on iPhone.


## v0.5 UI changes
- 0.5-hour circular wind-direction dial optimized for touch
- Wind model selector moved to the top bar
- Blue field UI theme
- Result unit MIL reduced to the same visual weight as L/R
