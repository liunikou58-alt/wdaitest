const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const htmlPath = path.join(__dirname, 'WDMC_API_Cost_Report.html');
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 });
  await page.pdf({
    path: path.join(__dirname, 'WDMC_API費用評估報告_20260404.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '25mm', left: '18mm', right: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;text-align:center;font-size:8pt;color:#999;padding:0 40px"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  console.log('PDF generated: WDMC_API費用評估報告_20260404.pdf');
  await browser.close();
})();
