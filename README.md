# ChessDrill

ChessDrill is a focused, browser-based chess opening trainer. Choose exact variations, set the side and depth you want to practice, and play the repertoire moves on an interactive board.

## Features

- 124 organized opening families with 3,755 individually selectable named lines across ECO A00–E99
- Fine-grained line selection and maximum-depth control
- Search, ECO/name/variation-count sorting, and White/Black opening-focus filters
- White, Black, or repertoire-side practice
- Spaced rotation that emphasizes new and missed lines, rests lines you just answered cleanly, and only schedules lines the chosen side can actually play
- Click-to-move interactive chessboard with legal move guidance
- Hints, reveal-and-continue, accuracy tracking, and persistent local progress
- Responsive desktop and mobile layout
- No account or backend required

## Development

```bash
npm install
npm run dev
```

Run tests and create the production bundle:

```bash
npm test
npm run build
```

## GitHub Pages

The included workflow builds and publishes the app whenever `main` is updated. In the repository settings, select **GitHub Actions** as the Pages source.

Opening data is stored in `src/openings.js`, making it straightforward to expand the built-in repertoire.

## Opening data

The bundled catalog is generated from the 3,815 public-domain records in [`lichess-org/chess-openings`](https://github.com/lichess-org/chess-openings) (CC0). Related accepted/declined and “with …” subfamilies are organized under their parent opening, while duplicate truncated main lines are consolidated so every opening family has exactly one main line. To regenerate it after downloading that repository:

```bash
node scripts/generate-openings.mjs path/to/chess-openings/{a,b,c,d,e}.tsv
```
