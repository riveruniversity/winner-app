const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Capture console errors with full details
  page.on('console', async msg => {
    if (msg.type() === 'error') {
      console.log('\n=== Console Error ===');
      console.log('Text:', msg.text());
      
      // Try to get the stack trace and location
      try {
        const args = msg.args();
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          const value = await arg.evaluate(node => {
            if (node instanceof Error) {
              return {
                message: node.message,
                stack: node.stack
              };
            }
            return node;
          }).catch(() => null);
          
          if (value) {
            console.log(`Arg ${i}:`, value);
          }
        }
      } catch (e) {}
      
      // Get the location
      const location = msg.location();
      if (location) {
        console.log('Location:', location);
      }
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Try clicking a tab to trigger the error
  console.log('\nClicking Lists tab...');
  await page.click('#lists-tab');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\nClicking Prizes tab...');
  await page.click('#prizes-tab');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await browser.close();
})();