import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

  try {
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully');
    
    // Simulate pressing V to enter 3rd person
    await page.keyboard.press('v');
    console.log('Pressed V');
    
    // Simulate clicking in the center of the screen
    await page.mouse.move(500, 500);
    await page.mouse.down();
    await page.mouse.up();
    console.log('Clicked mouse');
    
    // Simulate holding mouse and moving W
    await page.mouse.down();
    await page.keyboard.down('w');
    await new Promise(r => setTimeout(r, 1000)); // hold W for 1s
    await page.keyboard.up('w');
    await page.mouse.up();
    console.log('Moved W while printing');

    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.error('Test script error:', e);
  } finally {
    await browser.close();
  }
})();
