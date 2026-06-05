import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const b = await chromium.launch({ headless: true });
const p = await b.newPage();
await p.setViewportSize({ width: 1400, height: 900 });

// Login first
await p.goto('http://localhost:3000/login');
await p.waitForTimeout(1000);
await p.screenshot({ path: 'C:/Users/thedi/AppData/Local/Temp/login.png' });
console.log('login page:', await p.title());
await b.close();
