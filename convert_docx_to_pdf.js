const mammoth = require('mammoth');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const inputFile = path.join('C:\\Users\\user\\Downloads', '09-115年度中科盃球類競賽暨路跑活動需求說明書.docx');
const outputFile = path.join('C:\\Users\\user\\Downloads', '09-115年度中科盃球類競賽暨路跑活動需求說明書.pdf');

(async () => {
  console.log('正在讀取 DOCX 檔案...');
  
  // 1. 用 mammoth 將 docx 轉成 HTML
  const result = await mammoth.convertToHtml({ path: inputFile }, {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
    ]
  });
  
  const htmlContent = result.value;
  if (result.messages.length > 0) {
    console.log('轉換訊息:', result.messages.map(m => m.message).join('; '));
  }
  
  // 2. 包裝成完整 HTML 頁面（含專業排版樣式）
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Noto Sans TC', 'Microsoft JhengHei', '微軟正黑體', sans-serif;
    font-size: 12pt;
    line-height: 1.8;
    color: #1a1a1a;
    padding: 0;
  }
  
  /* Page content area */
  .content {
    padding: 15mm 20mm;
  }

  h1 {
    font-size: 20pt;
    font-weight: 900;
    text-align: center;
    margin: 20px 0 24px;
    color: #111;
    letter-spacing: 1px;
  }
  h2 {
    font-size: 15pt;
    font-weight: 700;
    margin: 20px 0 10px;
    color: #222;
    border-bottom: 1.5px solid #ccc;
    padding-bottom: 4px;
  }
  h3 {
    font-size: 13pt;
    font-weight: 700;
    margin: 16px 0 8px;
    color: #333;
  }
  
  p {
    margin: 6px 0;
    text-align: justify;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 11pt;
  }
  th, td {
    border: 1px solid #666;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f0f0f0;
    font-weight: 700;
  }
  
  ul, ol {
    margin: 8px 0 8px 24px;
  }
  li {
    margin: 4px 0;
  }
  
  img {
    max-width: 100%;
    height: auto;
    margin: 10px 0;
  }

  strong, b { font-weight: 700; }
  
  /* Page break hints */
  h1, h2 { page-break-after: avoid; }
  table { page-break-inside: avoid; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="content">
${htmlContent}
</div>
</body>
</html>`;

  // 3. 用 Puppeteer 轉 PDF
  console.log('正在產生 PDF...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });
  
  await page.pdf({
    path: outputFile,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '20mm', right: '20mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#999;">- <span class="pageNumber"></span> -</div>',
  });
  
  await browser.close();
  
  const size = (fs.statSync(outputFile).size / 1024).toFixed(1);
  console.log(`\n✅ PDF 已產生: ${outputFile}`);
  console.log(`   檔案大小: ${size} KB`);
})();
