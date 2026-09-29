// Copies the source (no build output, test data, tools or node_modules) into a target folder.
//   node scripts/export-source.mjs <target-folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: node scripts/export-source.mjs <target-folder>');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'site', 'tools', '.git', 'shots', '.netlify']);
const SKIP_FILES = new Set(['smoke.out', 'smoke.err']);
let n = 0, bytes = 0;
function copy(dir, out) {
  fs.mkdirSync(out, { recursive: true });
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || /^\.(userdata|real|ud)-/.test(e.name)) continue;
      copy(path.join(dir, e.name), path.join(out, e.name));
    } else if (!SKIP_FILES.has(e.name)) {
      fs.copyFileSync(path.join(dir, e.name), path.join(out, e.name));
      n++; bytes += fs.statSync(path.join(dir, e.name)).size;
    }
  }
}
copy(root, target);
console.log(`${n} files, ${(bytes / 1048576).toFixed(1)} MB copied to ${target}`);
