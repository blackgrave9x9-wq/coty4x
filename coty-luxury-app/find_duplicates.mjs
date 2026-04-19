import fs from 'fs';
import path from 'path';

const srcDir = './src';
const files = fs.readdirSync(srcDir).filter(f => f.startsWith('products_') && f.endsWith('.ts'));

const ids = new Map();

files.forEach(file => {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  const matches = content.matchAll(/id: '([^']+)'/g);
  for (const match of matches) {
    const id = match[1];
    if (ids.has(id)) {
      ids.get(id).push(file);
    } else {
      ids.set(id, [file]);
    }
  }
});

let found = false;
for (const [id, locations] of ids.entries()) {
  if (locations.length > 1) {
    console.log(`Duplicate ID: ${id} found in: ${locations.join(', ')}`);
    found = true;
  }
}

if (!found) {
  console.log('No duplicate IDs found.');
}
