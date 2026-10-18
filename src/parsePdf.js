const { PDFParse } = require('pdf-parse');

const DISTRICTS = new Set([
  'Central',
  'North East',
  'North West',
  'South East',
  'South West',
]);

function groupLines(textContent) {
  const lines = new Map();
  for (const item of textContent.items) {
    if (!('str' in item)) continue;
    const y = Math.round(item.transform[5]);
    if (!lines.has(y)) lines.set(y, []);
    lines.get(y).push(item);
  }
  return [...lines.keys()].sort((a, b) => b - a).map((y) => ({
    y,
    items: lines.get(y).sort((a, b) => a.transform[4] - b.transform[4]),
  }));
}

function columnText(items, minX, maxX) {
  return items
    .filter((it) => it.transform[4] >= minX && it.transform[4] < maxX)
    .map((it) => it.str)
    .join('')
    .trim();
}

async function parseShelters(buffer) {
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const shelters = [];
  for (let i = 1; i <= parser.doc.numPages; i += 1) {
    const page = await parser.doc.getPage(i);
    const tc = await page.getTextContent();
    for (const line of groupLines(tc)) {
      const district = columnText(line.items, 0, 100);
      const name = columnText(line.items, 100, 280);
      const address = columnText(line.items, 280, 500);
      const postal = columnText(line.items, 500, 9999);
      if (!DISTRICTS.has(district)) continue;
      if (!/^\d{6}$/.test(postal)) continue;
      if (!name) continue;
      shelters.push({ district, name, address, postalCode: postal });
    }
  }
  await parser.destroy();
  return shelters;
}

module.exports = { parseShelters };
