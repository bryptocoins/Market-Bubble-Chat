// Grab the @MarketBubble profile avatar (public CDN image) for branding.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { X_PROFILE_DIR } from '../src/ingestors/x.js';

const HANDLE = process.argv[2] || 'MarketBubble';
const OUT = resolve(fileURLToPath(import.meta.url), '../../../web/public/marketbubble.jpg');

async function main() {
  const { chromium } = await import('playwright');
  const ctx = await chromium.launchPersistentContext(X_PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`https://x.com/${HANDLE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Grab the avatar from MarketBubble's own avatar container specifically.
  const srcs: string[] = await page.evaluate(
    `(function(){
       var c = document.querySelector('[data-testid="UserAvatar-Container-` +
      HANDLE +
      `"]') || document;
       return Array.from(c.querySelectorAll('img')).map(function(i){return i.src;})
         .filter(function(s){return s.indexOf('profile_images')!==-1;});
     })()`,
  );
  console.log('avatar urls for ' + HANDLE + ':', srcs.slice(0, 5));
  if (!srcs.length) {
    console.error('no avatar found');
    await ctx.close();
    process.exit(1);
  }
  // Upscale to 400x400. Keep the real extension.
  const url = srcs[0].replace(/_(normal|bigger|mini|\d+x\d+)\./, '_400x400.');
  const ext = url.split('?')[0].endsWith('.png') ? 'png' : 'jpg';
  const out = OUT.replace(/\.jpg$/, '.' + ext);
  console.log('downloading:', url);
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(out, buf);
  console.log('saved', buf.length, 'bytes to', out);
  await ctx.close();
  process.exit(0);
}
void main();
