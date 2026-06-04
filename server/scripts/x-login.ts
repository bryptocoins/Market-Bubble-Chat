// One-time X login. Opens a real browser using the same persistent profile the
// X ingestor reuses. Log into x.com, then close the window — your session is
// saved and the ingestor will capture from your authenticated session.

import { X_PROFILE_DIR } from '../src/ingestors/x.js';

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Playwright not installed. Run: npm --prefix server install');
    process.exit(1);
  }

  console.log(`\n  Opening X with profile: ${X_PROFILE_DIR}`);
  console.log('  → Log into x.com in the window, then CLOSE it to save your session.\n');

  const ctx = await chromium.launchPersistentContext(X_PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' }).catch(() => {});

  // Stay alive until the user closes the browser.
  await new Promise<void>((res) => {
    ctx.on('close', () => res());
  });
  console.log('  Session saved. You can start the app now.');
  process.exit(0);
}

void main();
