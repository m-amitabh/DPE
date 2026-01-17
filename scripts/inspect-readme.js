const fs = require('fs');
const path = require('path');
const txt = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
const lines = txt.split(/\r?\n/);
const start = 60; // 1-based approx
for (let i = 56; i <= 76 && i < lines.length; i++) {
  const line = lines[i] || '';
  const codes = Array.from(line).map(c => c.codePointAt(0).toString(16).padStart(4,'0'));
  console.log((i+1).toString().padStart(3,' ')+": "+line);
  console.log('     codes: '+codes.join(' '));
}
