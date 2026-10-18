const fs = require('fs');

const CACHE_PATH = process.env.GEOCODE_CACHE || 'data/geocode-cache.json';

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(require('path').dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

async function geocodePostal(postal, cache) {
  if (Object.prototype.hasOwnProperty.call(cache, postal) && cache[postal] !== null) return cache[postal];
  // retry nulls too, but allow attempts
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const headers = { 'User-Agent': 'sg-haze-shelters/1.0' };
      if (process.env.ONEMAP_TOKEN) headers.Authorization = process.env.ONEMAP_TOKEN;
      const res = await fetch(url, { headers });
      const json = await res.json();
      const r = json.results && json.results[0];
      if (r) {
        const value = { lat: parseFloat(r.LATITUDE), lng: parseFloat(r.LONGITUDE) };
        cache[postal] = value;
        return value;
      }
      // no result; stop retrying
      cache[postal] = null;
      return null;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  cache[postal] = null;
  return null;
}

async function geocodeAll(shelters) {
  const cache = loadCache();
  const unique = [...new Set(shelters.map((s) => s.postalCode))];
  for (const postal of unique) {
    await geocodePostal(postal, cache);
    // polite delay
    await new Promise((r) => setTimeout(r, 300));
  }
  saveCache(cache);
  return shelters.map((s) => {
    const c = cache[s.postalCode];
    return { ...s, latitude: c ? c.lat : null, longitude: c ? c.lng : null };
  });
}

module.exports = { geocodeAll, loadCache, saveCache };
