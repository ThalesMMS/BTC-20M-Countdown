# 20M Bitcoin Countdown

A single-page countdown that estimates when Bitcoin’s mined supply reaches 20,000,000 BTC. It pulls the latest block data from mempool.space, computes the subsidy-based supply from the protocol schedule, and projects time using the average block interval.

## Features
- Live block height and blocks remaining to the 20M milestone.
- Subsidy-based BTC mined and remaining calculations (no arbitrary constants).
- Estimated date based on the average time of the last 10 blocks.
- Smooth flip-style countdown UI with periodic API refresh.

## How It Works
- **Target block** is computed from the Bitcoin issuance schedule (halving every 210,000 blocks).
- **BTC mined** is calculated from block subsidy only (fees are excluded, as they do not create BTC).
- **Time estimate** is anchored to the timestamp of the latest block and uses the last 10 blocks average interval.

## Getting Started
1. Open `index.html` in a browser.
2. The page will load live data and update automatically every 30 seconds.

## Development
1. Install dependencies: `npm install`
2. Compile TypeScript: `npm run build`

`script.ts` is the source. `script.js` is compiled output and is not committed to the repository.
If you open `index.html` locally, make sure you run the build first so `script.js` exists.

## Deploy to GitHub Pages
1. Push this repo to GitHub.
2. In the repo settings, go to **Pages**.
3. Select your default branch and `/ (root)` as the source.
4. Save and wait for GitHub to publish the site.

This repository includes a GitHub Actions workflow that builds `script.js` and publishes
the site automatically on pushes to `main`.

## Data Source
- mempool.space API (`/api/blocks` and `/api/blocks/tip/height` as a fallback)

## Disclaimer
This is an estimate. Block times are probabilistic and can vary; the displayed date is a projection based on recent network conditions.

## License
MIT License. See `LICENSE`.
