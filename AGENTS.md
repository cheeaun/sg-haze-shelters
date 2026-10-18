# AGENTS.md

## Project

Daily scraper for Singapore community haze shelters. Source page:
https://www.pa.gov.sg/our-network/community-clubs/shelters/ (PDF link).

## Structure

- `src/scrape.js` — fetch page, find PDF link, download, parse, geocode, write outputs.
- `src/parsePdf.js` — PDF text extraction via `pdf-parse`, coordinate-based columns.
- `src/geocode.js` — OneMap postal-code geocoding with cache.
- `scripts/changelog.js` — regenerate `CHANGELOG.md` from git log.
- `data/` — generated JSON/GeoJSON plus geocode cache.
- `.github/workflows/scrape.yml` — daily automation.

## Commands

- `npm run scrape`
- `npm run changelog`

## Notes

- PDF parser runs in-project via `pdf-parse`; do not rely on system tools.
- Geocoding uses OneMap search; optional `ONEMAP_TOKEN` env improves limits.
- Outputs are committed by CI when changed.
EOF