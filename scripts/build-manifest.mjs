import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, base, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) {
      walk(full, rel, out);
    } else {
      out.push(rel);
    }
  }
}

const files = [];
walk('components', 'components', files);
walk('lib', 'lib', files);
walk('app', 'app', files);

const skip = ['app/favicon.ico'];
const finalFiles = files.filter((f) => !skip.includes(f));
finalFiles.push('package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs', 'next-env.d.ts');

const manifest = finalFiles.map((f) => ({ file: f, data: fs.readFileSync(f, 'utf-8') }));
fs.writeFileSync(path.join(__dirname, '..', 'deploy-manifest.json'), JSON.stringify(manifest));
console.log('files:', manifest.length);
console.log('total bytes:', JSON.stringify(manifest).length);
