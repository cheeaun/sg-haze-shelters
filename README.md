# SG Haze Shelters

Daily scraper for Singapore's community haze shelters, sourced from the
[People's Association](https://www.pa.gov.sg/our-network/community-clubs/shelters/)
list (PDF). Produces structured `JSON` and `GeoJSON` outputs and tracks
changes through git with an auto-generated changelog.

## Data

- `data/shelters.json` — full list with district, name, address, postal code, and coordinates.
- `data/shelters.geojson` — GeoJSON `FeatureCollection` of shelter points.
- `data/geocode-cache.json` — cached postal-code geocoding results.

## Usage

```bash
npm install
npm run scrape      # fetch PDF, parse, geocode, write data/
npm run changelog   # regenerate CHANGELOG.md from git history
```

## Automation

A GitHub Actions workflow (`.github/workflows/scrape.yml`) runs daily,
scrapes the PDF, regenerates the changelog, and commits changes when the
list differs.

## PDF parsing

Parsing is handled in-project with `pdf-parse` (`src/parsePdf.js`), using
coordinate-based column extraction so it does not depend on external tools.
EOF