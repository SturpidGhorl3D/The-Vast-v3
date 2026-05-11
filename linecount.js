const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  if (dir.includes('node_modules') || dir.includes('.next') || dir.includes('.git') || dir.includes('dist')) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, files);
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        files.push(filePath);
      }
    }
  }
  return files;
}

const files = getFiles('.');
const counts = files.map(f => {
  const content = fs.readFileSync(f, 'utf8');
  return { file: f, lines: content.split('\n').length };
});

counts.sort((a, b) => b.lines - a.lines);
counts.slice(0, 30).forEach(c => console.log(`${c.lines}: ${c.file}`));
