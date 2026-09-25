# Wind Drift v0.9

Static, mobile-first wind-correction prototype designed for later deployment on GitHub Pages.

## v0.9 changes

- Intermediate coordinates are shown side-by-side for faster field reading.
- In `%` mode, the percentage and calculated distance in metres are both large and on the same line.
- In `м` mode, the entered distance and calculated percentage are both large and on the same line.
- Calculation logic is unchanged from v0.9.


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


## v0.9
- Більші дублюючі координати м/% поруч з основним значенням.
- Дублююче значення оновлюється на кожному input/русі повзунка.
- Footer з версією та посиланням RangeRabbit.


## v0.9
Проміжні точки одночасно мають повзунок 0–100% і поле дистанції в метрах. Керування синхронізоване в обидва боки; останній змінений тип координати лишається внутрішнім джерелом позиції при зміні дистанції цілі.
