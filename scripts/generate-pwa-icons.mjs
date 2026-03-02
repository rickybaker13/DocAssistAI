import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const inputSvg = resolve(root, 'public/icon.svg');

const targets = [
  { path: resolve(root, 'public/generated/icon-192.png'), size: 192 },
  { path: resolve(root, 'public/generated/icon-512.png'), size: 512 },
  { path: resolve(root, 'public/generated/apple-touch-icon.png'), size: 180 },
];

const svg = readFileSync(inputSvg);

for (const target of targets) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: target.size },
    background: 'rgba(0, 0, 0, 0)',
  });

  const pngData = resvg.render().asPng();
  mkdirSync(dirname(target.path), { recursive: true });
  writeFileSync(target.path, pngData);
  console.log(`generated ${target.path}`);
}
