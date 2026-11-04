import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { buildSeed } from './seed.mjs';

const OUT = process.argv[2] ?? 'public/screenshots';
const BASE = 'http://127.0.0.1:3000/';
const CHROME = process.env.PW_CHROME;
mkdirSync(OUT, { recursive: true });

const launch = () =>
  chromium.launch({
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

async function withApp(theme, fn) {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,
      locale: 'fa-IR',
      timezoneId: 'Asia/Tehran',
      reducedMotion: 'reduce',
    });
    await ctx.addInitScript((payload) => {
      localStorage.setItem('ashpazkhane-store', JSON.stringify(payload));
    }, buildSeed(theme));
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 160)));
    await p.goto(BASE, { waitUntil: 'load', timeout: 20000 });
    await p.waitForTimeout(2500); // splash
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    await fn(p);
  } finally {
    await browser.close();
  }
}

const tab = async (p, label) => {
  await p.locator('.bottom-nav .nav-tab', { hasText: label }).click();
  await p.waitForTimeout(600);
};

const shot = async (p, name) => {
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
};

const scrollHome = (p, top) =>
  p.evaluate((value) => {
    const el = document.querySelector('.scroll-content');
    if (el) el.scrollTop = value;
  }, top);

await withApp('light', async (p) => {
  await shot(p, 'home');
  await scrollHome(p, 560);
  await shot(p, 'home-lower');
  await scrollHome(p, 0);

  await tab(p, 'انبار');
  await shot(p, 'pantry');
  await tab(p, 'دستور');
  await shot(p, 'recipes');
  await tab(p, 'خرید');
  await shot(p, 'shopping');
  await tab(p, 'یادآور');
  await shot(p, 'reminders');

  // Detail sheet last: it hides the nav, so nothing else gets captured after it.
  await tab(p, 'دستور');
  await p.locator('.card-lg').first().click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/recipe-detail.png` });
  console.log('shot recipe-detail');
});

await withApp('dark', async (p) => {
  await shot(p, 'home-dark');
  await tab(p, 'انبار');
  await shot(p, 'pantry-dark');
});
