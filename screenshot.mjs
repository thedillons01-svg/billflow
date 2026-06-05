import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.setViewportSize({ width: 1400, height: 900 });

// Login
await p.goto('http://localhost:3000/login');
await p.waitForSelector('#email');
await p.fill('#email', 'billflowdev@gmail.com');
await p.fill('#password', 'Stopthesteal11');
await Promise.all([
  p.waitForNavigation({ timeout: 10000 }).catch(() => {}),
  p.click('button[type="submit"]'),
]);
await p.waitForTimeout(3000);
console.log('After login:', p.url());
await p.screenshot({ path: 'ss-after-login.png' });

if (p.url().includes('/login')) {
  console.log('Still on login — checking for error');
  const error = await p.locator('[style*="991B1B"]').textContent().catch(() => 'no error element');
  console.log('Error text:', error);
  await b.close();
  process.exit(1);
}

// Bills inbox
await p.goto('http://localhost:3000/bills');
await p.waitForTimeout(2000);
await p.screenshot({ path: 'ss-bills-list.png' });
console.log('Bills list:', p.url());

// Open first bill link
const billLinks = await p.locator('a[href^="/bills/"]').all();
console.log('Bill links found:', billLinks.length);
const billHref = billLinks.length > 0 ? await billLinks[0].getAttribute('href') : null;

if (billHref) {
  await p.goto('http://localhost:3000' + billHref);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'ss-bill-top.png' });
  console.log('Bill edit top screenshot taken');

  const scroll = (px) => p.evaluate((y) => {
    const el = Array.from(document.querySelectorAll('div')).find(d =>
      d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 300 && d.getBoundingClientRect().left < 600
    );
    if (el) el.scrollTop = y;
  }, px);

  await scroll(700);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'ss-bill-mid.png' });

  await scroll(1500);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'ss-bill-bottom.png' });
  console.log('Bill edit screenshots done');
}

// PO list
await p.goto('http://localhost:3000/purchase-orders');
await p.waitForTimeout(2000);
await p.screenshot({ path: 'ss-po-list.png' });

const poLinks = await p.locator('a[href^="/purchase-orders/"]').all();
console.log('PO links found:', poLinks.length);
const poHref = poLinks.length > 0 ? await poLinks[0].getAttribute('href') : null;

if (poHref) {
  await p.goto('http://localhost:3000' + poHref);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'ss-po-top.png' });

  await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d =>
      d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 300 && d.getBoundingClientRect().left < 600
    );
    if (el) el.scrollTop = 700;
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'ss-po-bottom.png' });
  console.log('PO screenshots done');
}

await b.close();
console.log('Done');
