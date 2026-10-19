const { execSync } = require('child_process');
const fs = require('fs');

const DATA_FILE = 'data/shelters.json';
const OUTPUT_FILE = 'CHANGELOG.md';

// A shelter's identity across snapshots. `name` is unique in the data.
const KEY_FIELD = 'name';

// Fields that represent real data. Latitude/longitude are derived from
// postalCode (via the geocode cache), so they are not tracked directly.
const TRACKED_FIELDS = ['district', 'address', 'postalCode'];

const FIELD_LABELS = {
  district: 'district',
  address: 'address',
  postalCode: 'postal code',
};

const HEADER = [
  '# Changelog',
  '',
  'Data changes to the community haze shelter list (`data/shelters.json`).',
].join('\n');

// ---------------------------------------------------------------------------
// Git / data access
// ---------------------------------------------------------------------------

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
}

function normalize(raw) {
  return {
    date: (raw.updated || '').slice(0, 10) || null,
    shelters: (raw.shelters || []).map((s) => ({
      district: s.district || '',
      name: s.name || '',
      address: s.address || '',
      postalCode: s.postalCode || '',
    })),
  };
}

function readFromGit(rev) {
  try {
    return normalize(JSON.parse(git(`show ${rev}:${DATA_FILE}`)));
  } catch {
    return null;
  }
}

function readWorkingTree() {
  let raw;
  try {
    raw = fs.readFileSync(DATA_FILE, 'utf8');
  } catch {
    return null;
  }
  try {
    return normalize(JSON.parse(raw));
  } catch (e) {
    throw new Error(`Failed to parse ${DATA_FILE}: ${e.message}`);
  }
}

function isShallow() {
  try {
    return git('rev-parse --is-shallow-repository').trim() === 'true';
  } catch {
    return false; // older git without the flag; assume full history
  }
}

// ---------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------

function shelterKey(s) {
  return s[KEY_FIELD];
}

// Index shelters by their identity key, keeping the first occurrence of any
// duplicate and warning (a duplicate would otherwise be silently dropped).
function index(shelters) {
  const map = new Map();
  let duplicates = 0;
  for (const s of shelters) {
    const key = shelterKey(s);
    if (map.has(key)) {
      duplicates += 1;
      continue;
    }
    map.set(key, s);
  }
  if (duplicates) {
    console.warn(`warning: ${duplicates} duplicate ${KEY_FIELD} value(s); keeping first occurrence`);
  }
  return map;
}

function diff(prev, next) {
  const prevMap = index(prev.shelters);
  const nextMap = index(next.shelters);

  const added = next.shelters.filter((s) => !prevMap.has(shelterKey(s)));
  const removed = prev.shelters.filter((s) => !nextMap.has(shelterKey(s)));

  const changed = [];
  for (const s of next.shelters) {
    const o = prevMap.get(shelterKey(s));
    if (!o) continue;
    const fields = TRACKED_FIELDS
      .filter((f) => o[f] !== s[f])
      .map((f) => ({ field: f, from: o[f], to: s[f] }));
    if (fields.length) changed.push({ shelter: s, fields });
  }

  return { added, removed, changed };
}

function hasChanges(d) {
  return d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function describe(s) {
  const bits = [];
  if (s.address) bits.push(s.address);
  const place = [s.district, s.postalCode].filter(Boolean).join(' ');
  if (place) bits.push(place);
  return bits.length ? ` — ${bits.join(', ')}` : '';
}

function quote(v) {
  return v ? `"${v}"` : '_empty_';
}

function renderSection(date, d) {
  const lines = [`## ${date}`, ''];
  for (const s of d.added) lines.push(`- **Added** ${s.name}${describe(s)}`);
  for (const s of d.removed) lines.push(`- **Removed** ${s.name}${describe(s)}`);
  for (const { shelter, fields } of d.changed) {
    const detail = fields
      .map((f) => `${FIELD_LABELS[f.field]}: ${quote(f.from)} → ${quote(f.to)}`)
      .join('; ');
    lines.push(`- **Changed** ${shelter.name} — ${detail}`);
  }
  if (!hasChanges(d)) lines.push('- No changes.');
  return lines.join('\n');
}

function renderBaseline(snap) {
  return [
    `## ${snap.date || 'unknown'}`,
    '',
    `- Initial snapshot — ${snap.shelters.length} shelters.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// CHANGELOG.md read / write
// ---------------------------------------------------------------------------

function readSections(text) {
  const idx = text.search(/^## /m);
  if (idx === -1) return [];
  return text.slice(idx)
    .split(/(?=^## )/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstLine(section) {
  return section.split('\n', 1)[0].trim();
}

function writeFile(sections) {
  const body = sections.map((s) => s.trimEnd()).join('\n\n');
  fs.writeFileSync(OUTPUT_FILE, body ? `${HEADER}\n\n${body}\n` : `${HEADER}\n`);
}

// ---------------------------------------------------------------------------
// Mode: full — rebuild the whole changelog from the file's git history.
// ---------------------------------------------------------------------------

function snapshots() {
  let hashes = [];
  try {
    hashes = git(`log --reverse --format=%H -- ${DATA_FILE}`).trim().split('\n').filter(Boolean);
  } catch {
    hashes = [];
  }

  const revs = hashes.map((h) => readFromGit(h)).filter(Boolean);
  const working = readWorkingTree();
  if (working) revs.push(working);
  return revs;
}

// Group revisions by their `updated` date, keeping the last snapshot for each
// date (multiple commits on one day collapse to the day's net state), then
// order chronologically by date.
function groupByDate(revs) {
  const groups = [];
  for (const rev of revs) {
    const last = groups[groups.length - 1];
    if (last && rev.date && last.date === rev.date) {
      last.snapshot = rev;
      continue;
    }
    groups.push({ date: rev.date, snapshot: rev });
  }
  groups.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return groups;
}

function fullMode() {
  if (isShallow()) {
    throw new Error(
      'Full mode needs complete git history but this is a shallow clone. ' +
      'Fetch full history (actions/checkout with fetch-depth: 0), or use diff mode.',
    );
  }

  const groups = groupByDate(snapshots());
  const sections = [];

  for (let i = 0; i < groups.length; i += 1) {
    if (i === 0) {
      sections.push(renderBaseline(groups[0].snapshot));
      continue;
    }
    const d = diff(groups[i - 1].snapshot, groups[i].snapshot);
    sections.push(renderSection(groups[i].date || 'unknown', d));
  }

  if (!sections.length) sections.push('_No data snapshots found._');
  writeFile(sections.reverse());
  console.log(`Wrote ${OUTPUT_FILE} (full, ${groups.length} day(s))`);
}

// ---------------------------------------------------------------------------
// Mode: diff — compare the working tree against HEAD and prepend one entry.
// ---------------------------------------------------------------------------

function diffMode() {
  const current = readWorkingTree();
  if (!current) throw new Error(`Missing ${DATA_FILE}`);

  const previous = readFromGit('HEAD');
  const date = current.date || new Date().toISOString().slice(0, 10);

  const d = previous
    ? diff(previous, current)
    : { added: current.shelters, removed: [], changed: [] };

  const existing = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf8') : '';
  const sections = readSections(existing);
  const existingForDate = sections.find((s) => firstLine(s) === `## ${date}`);

  // Never overwrite a recorded change for this date with a "No changes" entry
  // (can happen when the same date is regenerated after its change was
  // committed). Leave the file untouched in that case.
  if (!hasChanges(d) && existingForDate) {
    console.log(`Wrote ${OUTPUT_FILE} (diff: no changes, ${date} already recorded)`);
    return;
  }

  const section = renderSection(date, d);
  const kept = sections.filter((s) => firstLine(s) !== `## ${date}`);
  writeFile([section, ...kept]);

  const summary = hasChanges(d)
    ? `${d.added.length} added, ${d.removed.length} removed, ${d.changed.length} changed`
    : 'no changes';
  console.log(`Wrote ${OUTPUT_FILE} (diff: ${summary})`);
}

// ---------------------------------------------------------------------------

function main() {
  const mode = process.argv.includes('--diff') ? diffMode : fullMode;
  mode();
}

try {
  main();
} catch (e) {
  console.error(`changelog: ${e.message}`);
  process.exit(1);
}
