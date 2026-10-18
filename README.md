# SG Haze Shelters

Daily scraper for Singapore's community haze shelters, sourced from the
[People's Association](https://www.pa.gov.sg/our-network/community-clubs/shelters/)
list (PDF). Produces structured `JSON` and `GeoJSON` outputs and tracks
changes through git with an auto-generated changelog.

## Data

- [`data/shelters.json`](./data/shelters.json) — full list with district, name, address, postal code, and coordinates.
- [`data/shelters.geojson`](./data/shelters.geojson) — GeoJSON `FeatureCollection` of shelter points.
- [`data/shelters.csv`](./data/shelters.csv) — CSV export of the same list.

## References

- [Few use Singapore haze shelters, but visitors welcome respite from heat](https://www.reddit.com/r/singapore/comments/1x8aa8o/few_use_singapore_haze_shelters_but_visitors/) — Reddit, Oct 2026
- [Singapore Ready To Step Up Haze Response](https://www.nea.gov.sg/media/news/news/index/singapore-ready-to-step-up-haze-response) — NEA, 09 Oct 2026
- [Haze Situation Update (14 October 2026)](https://www.nea.gov.sg/media/news/advisories/index/haze-situation-update-14-october-2026) — NEA, 14 Oct 2026
- [Few use Singapore haze shelters, but visitors welcome respite from heat](https://www.channelnewsasia.com/singapore/singapore-haze-shelters-heat-visitors-community-centres-6468211) — CNA, 17 Oct 2026

## Usage

```bash
npm install
npm run scrape      # fetch PDF, parse, geocode, write data/
npm run changelog   # regenerate CHANGELOG.md from git history
```

See [CHANGELOG.md](./CHANGELOG.md) for history of changes.

A GitHub Actions workflow (`.github/workflows/scrape.yml`) runs daily,
scrapes the PDF, regenerates the changelog, and commits changes when the
list differs.

## PDF parsing

Parsing is handled in-project with `pdf-parse` (`src/parsePdf.js`), using
coordinate-based column extraction so it does not depend on external tools.
EOF