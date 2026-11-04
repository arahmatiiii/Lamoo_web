import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'artifacts';
const URL = 'http://127.0.0.1:3000/landing.html';
const CHROME = process.env.PW_CHROME;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}),
  args: ['--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

const errors = [];

async function open(viewport, name) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'fa-IR' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(name + ': ' + m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errors.push(name + ': pageerror ' + String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(900);
  return { ctx, p };
}

async function revealAll(p) {
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.75;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

{
  const { ctx, p } = await open({ width: 1440, height: 940 }, 'desktop');
  await p.screenshot({ path: OUT + '/landing-hero.png' });
  await revealAll(p);
  await p.screenshot({ path: OUT + '/landing-desktop.png', fullPage: true });
  for (const [sel, name] of [['#features', 'sec-features'], ['#how', 'sec-how'], ['#shared', 'sec-shared'], ['#ai', 'sec-ai'], ['#faq', 'sec-faq']]) {
    const el = p.locator(sel);
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await el.screenshot({ path: OUT + '/' + name + '.png' });
  }
  const band = p.locator('.cta-band');
  await band.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await band.screenshot({ path: OUT + '/sec-cta.png' });
  const sizes = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth, h: document.body.scrollHeight }));
  console.log('desktop', JSON.stringify(sizes));
  await ctx.close();
}

{
  const { ctx, p } = await open({ width: 390, height: 844 }, 'mobile');
  await p.screenshot({ path: OUT + '/landing-mobile-hero.png' });
  await revealAll(p);
  await p.screenshot({ path: OUT + '/landing-mobile.png', fullPage: true });
  const sizes = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth, h: document.body.scrollHeight }));
  console.log('mobile', JSON.stringify(sizes));
  await ctx.close();
}

await browser.close();
console.log('errors:', errors.length ? errors.join('\n') : 'none');
