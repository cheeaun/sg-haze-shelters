const { execSync } = require('child_process');
const fs = require('fs');

function gitLog() {
  try {
    return execSync('git log --pretty=format:%H%x1f%s%x1f%an%x1f%ad --date=short', { encoding: 'utf8' });
  } catch {
    return '';
  }
}

const lines = gitLog().trim().split('\n').filter(Boolean);
const entries = lines.map((l) => {
  const [hash, subject, author, date] = l.split('\x1f');
  return { hash: hash.slice(0, 7), subject, author, date };
});

// group by date
const byDate = {};
for (const e of entries) {
  if (!byDate[e.date]) byDate[e.date] = [];
  byDate[e.date].push(e);
}

let md = '# Changelog\n\n';
md += 'Generated from git history.\n\n';
for (const date of Object.keys(byDate).sort().reverse()) {
  md += `## ${date}\n\n`;
  for (const e of byDate[date]) {
    md += `- ${e.subject} (${e.hash})\n`;
  }
  md += '\n';
}

fs.writeFileSync('CHANGELOG.md', md);
console.log('Wrote CHANGELOG.md');
