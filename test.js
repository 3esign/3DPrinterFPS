import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('https://3dfps-a0pg577i8-3esigns-projects.vercel.app', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully');
    
    // Take screenshot
    await page.screenshot({ path: 'screenshot_prod.png' });
    console.log('Screenshot saved to screenshot_prod.png');
  } catch (e) {
    console.error('Test script error:', e);
  } finally {
    await browser.close();
  }
})();
