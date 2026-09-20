# ChessDrill

ChessDrill is a focused, browser-based chess opening trainer. Choose exact variations, set the side and depth you want to practice, and play the repertoire moves on an interactive board.

## Features

- Six starter opening repertoires with 21 individually selectable lines
- Fine-grained line selection and maximum-depth control
- White, Black, or repertoire-side practice
- Weighted rotation that emphasizes new and missed lines
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
