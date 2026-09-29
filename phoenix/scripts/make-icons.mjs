// Makes every PWA icon from app/icons/icon-512.png (the source artwork):
//   icon-192.png, icon-512.png            "any" icons
//   icon-maskable-512.png                 artwork inside the 80% safe zone on a solid background, so Android can crop it to any shape
//   apple-touch-icon.png (180)            iOS home screen (no transparency, iOS fills it with black otherwise)
// Uses sharp, borrowed from the sibling project's node_modules (a dev-time tool only).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || 'C:/Users/dgray/WebstormProjects/neurohub-identity-course/node_modules/sharp');
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'icons');
const src = path.join(dir, 'icon-512.png');
const BG = '#fffbf2';

const base = await sharp(src).png().toBuffer();
await sharp(base).resize(192, 192).png().toFile(path.join(dir, 'icon-192.png'));

const inner = await sharp(base).resize(410, 410).png().toBuffer(); // 80% of 512
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: inner, gravity: 'centre' }]).png().toFile(path.join(dir, 'icon-maskable-512.png'));

const inner180 = await sharp(base).resize(148, 148).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: BG } })
  .composite([{ input: inner180, gravity: 'centre' }]).flatten({ background: BG }).png().toFile(path.join(dir, 'apple-touch-icon.png'));
console.log('icons written to', dir);
