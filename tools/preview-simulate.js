const fs = require('fs');
const path = require('path');

async function preview(filePath) {
  const abs = path.resolve(filePath);
  const content = await fs.promises.readFile(abs, 'utf8');
  const parsed = JSON.parse(content || '{}');
  const incoming = Array.isArray(parsed.projects) ? parsed.projects : [];
  const sample = incoming.slice(0, 10).map(p => ({ id: p.id, name: p.name, path: p.path, provider: p.provider }));
  return { filePath: abs, count: incoming.length, sample };
}

(async () => {
  try {
    const res = await preview(process.argv[2] || './tools/sample-import.json');
    console.log('Preview result:');
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
