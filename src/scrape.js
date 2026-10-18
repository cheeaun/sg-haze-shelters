const fs = require('fs');
const path = require('path');
const { parseShelters } = require('./parsePdf');
const { geocodeAll } = require('./geocode');

const PAGE_URL = 'https://www.pa.gov.sg/our-network/community-clubs/shelters/';
const DATA_DIR = path.join(process.cwd(), 'data');

async function fetchPage() {
  const res = await fetch(PAGE_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (sg-haze-shelters)' } });
  if (!res.ok) throw new Error(`page fetch failed: ${res.status}`);
  return res.text();
}

function findPdfUrl(html) {
  const m = html.match(/href="([^"]+\.pdf)"/i);
  if (!m) throw new Error('PDF link not found');
  const url = m[1];
  return url.startsWith('http') ? url : new URL(url, PAGE_URL).href;
}

async function fetchPdf(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (sg-haze-shelters)' } });
  if (!res.ok) throw new Error(`pdf fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function writeOutputs(shelters, sourcePdf) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const updated = new Date().toISOString();
  const json = { source: PAGE_URL, pdf: sourcePdf, updated, count: shelters.length, shelters };
  fs.writeFileSync(path.join(DATA_DIR, 'shelters.json'), JSON.stringify(json, null, 2) + '\n');

  const geojson = {
    type: 'FeatureCollection',
    features: shelters.map((s) => ({
      type: 'Feature',
      properties: {
        district: s.district,
        name: s.name,
        address: s.address,
        postalCode: s.postalCode,
      },
      geometry: s.latitude != null && s.longitude != null
        ? { type: 'Point', coordinates: [s.longitude, s.latitude] }
        : null,
    })),
  };
  fs.writeFileSync(path.join(DATA_DIR, 'shelters.geojson'), JSON.stringify(geojson, null, 2) + '\n');

  const header = ['district', 'name', 'address', 'postalCode', 'latitude', 'longitude'];
  const csvRows = [header.join(',')];
  for (const s of shelters) {
    const vals = [s.district, s.name, s.address, s.postalCode, s.latitude, s.longitude];
    csvRows.push(vals.map((v) => {
      const str = v == null ? '' : String(v);
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    }).join(','));
  }
  fs.writeFileSync(path.join(DATA_DIR, 'shelters.csv'), csvRows.join('\n') + '\n');
}

async function main() {
  const html = await fetchPage();
  const pdfUrl = findPdfUrl(html);
  console.log('PDF:', pdfUrl);
  const buf = await fetchPdf(pdfUrl);
  const shelters = await parseShelters(buf);
  console.log('Parsed', shelters.length, 'shelters');
  const enriched = await geocodeAll(shelters);
  writeOutputs(enriched, pdfUrl);
  console.log('Wrote data files');
}

main().catch((e) => { console.error(e); process.exit(1); });
