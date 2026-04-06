// 批次匯入客戶競品廠商資料
const data = [
  { agency: '文化部', caseName: '國家漫畫博物館開展行銷推廣執行', amount: '820,000', winner2023: '', winner2024: '', winner2025: 'X', notes: '' },
  { agency: '文化部', caseName: '2024年臺灣文化遺產國際論壇', amount: '3,500,000', winner2023: '', winner2024: '', winner2025: '逢甲大學', notes: '' },
  { agency: '文化部文化資產局', caseName: '2024年A+文化資產創意獎競賽活動', amount: '6,500,000', winner2023: '', winner2024: '', winner2025: '藍本設計顧問有限公司', notes: '' },
  { agency: '文化部文化資產局', caseName: '水下探索號特展維運計畫', amount: '7,260,000', winner2023: '', winner2024: '西米創意設計有限公司', winner2025: 'X', notes: '' },
  { agency: '文化部文化資產局', caseName: '113年原住民族日系列活動執行暨展覽規劃案', amount: '1,326,000', winner2023: '', winner2024: '德立行銷顧問有限公司', winner2025: 'X', notes: '' },
  { agency: '文化部文化資產局', caseName: '2024全國古蹟日活動', amount: '7,000,000', winner2023: '', winner2024: '', winner2025: '星玉文創有限公司', notes: '' },
  { agency: '文化部文化資產局', caseName: '臺灣文化路徑推動社會發展計畫成果展示暨推廣計畫', amount: '8,985,000', winner2023: '', winner2024: '西米創意設計有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市政府文化局', caseName: '113年清眷森活藝術節', amount: '648,000', winner2023: 'X', winner2024: '加佳國際行銷有限公司', winner2025: '加佳國際行銷有限公司', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2024臺中媽祖國際觀光文化節-迎媽祖HOT陣頭', amount: '989,495', winner2023: '九天民俗技藝工作室', winner2024: '藝術聚落股份有限公司', winner2025: '無所不在創意活動有限公司', notes: '' },
  { agency: '臺中市政府文化局', caseName: '113年臺中市港區藝術中心自辦展覽推廣行銷', amount: '1,370,000', winner2023: 'X', winner2024: '沁嵐藝文整合有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2024臺中兒童藝術節', amount: '2,400,000', winner2023: '呈藝整合行銷有限公司', winner2024: '藝洋有限公司', winner2025: '刺點創作工坊', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2024臺中媽祖國際觀光文化節－宮廟風華', amount: '6,300,000', winner2023: '藝洋有限公司', winner2024: '', winner2025: '呈藝整合行銷有限公司', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2024書寫臺中城推廣活動', amount: '1,000,000', winner2023: '聯合報股份有限公司', winner2024: '木蘭文化事業有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2025臺中兒童藝術節', amount: '3,000,000', winner2023: '呈藝整合行銷有限公司', winner2024: '', winner2025: '刺點創作工坊', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2025臺中媽祖國際觀光文化節－宮廟風華', amount: '6,300,000', winner2023: '呈藝整合行銷有限公司', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2025臺中媽祖國際觀光文化節─大甲鎮瀾宮周邊演藝活動', amount: '4,300,000', winner2023: '無所不在創意活動有限公司（6年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府文化局', caseName: '2025親子藝術節', amount: '2,500,000', winner2023: '如果國際藝術事業股份有限公司（5年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府民政局', caseName: '臺中市113年度伊斯蘭開齋節慶祝活動', amount: '500,000', winner2023: '喬巧實業社', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府民政局', caseName: '臺中市113年度二二八和平紀念活動', amount: '600,000', winner2023: '喬巧實業社', winner2024: '', winner2025: '滿億文創事業社', notes: '' },
  { agency: '臺中市政府民政局', caseName: '2024臺中好聖誕活動', amount: '1,400,000', winner2023: '社團法人台中市教會發展策略聯盟協會', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府民政局', caseName: '臺中市113年移民節慶祝活動', amount: '800,000', winner2023: '中彰投廣告事業有限公司', winner2024: '喬巧實業社', winner2025: '藝洋有限公司', notes: '' },
  { agency: '臺中市政府民政局', caseName: '臺中市113年單身民眾聯誼活動', amount: '2,368,000', winner2023: '上置國際旅行社有限公司', winner2024: '亮紅有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市政府經濟發展局', caseName: '2024臺中鍋烤節', amount: '12,000,000', winner2023: 'X', winner2024: '聯利媒體股份有限公司', winner2025: '東森電視事業股份有限公司', notes: '' },
  { agency: '臺中市政府經濟發展局', caseName: '113年度臺中市山城地區商圈行銷計畫', amount: '1,600,000', winner2023: '高碲設計傳播有限公司（6年）', winner2024: '呈藝整合行銷有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市政府經濟發展局', caseName: '2024臺中糕餅及特色伴手禮產業推廣暨輔導計畫', amount: '8,000,000', winner2023: '高碲設計傳播有限公司（3年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府經濟發展局', caseName: '113年臺中市節電夥伴節能治理與推廣', amount: '15,000,000', winner2023: '鉅舵顧問有限公司', winner2024: '思維環境科技有限公司', winner2025: '鉅舵顧問有限公司', notes: '' },
  { agency: '臺中市政府社會局', caseName: '113年度臺中市模範母親與市長有約合照活動', amount: '850,000', winner2023: '高碲設計傳播有限公司（4年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府社會局', caseName: '113年度臺中市模範父親與市長有約合照活動', amount: '850,000', winner2023: '高碲設計傳播有限公司（3年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府社會局', caseName: '113年度臺中市績優社政人員表揚活動', amount: '773,000', winner2023: '高碲設計傳播有限公司', winner2024: '席綸整合行銷有限公司', winner2025: '席綸整合行銷有限公司', notes: '' },
  { agency: '臺中市政府建設局', caseName: '2024臺中市民野餐日活動整合行銷宣傳執行計畫', amount: '5,950,000', winner2023: '橙希創意行銷有限公司', winner2024: '', winner2025: '聯利媒體股份有限公司', notes: '' },
  { agency: '臺中市政府建設局', caseName: '臺中市政府建設局公共建設成果推廣', amount: '3,000,000', winner2023: 'X', winner2024: '遠見天下文化出版股份有限公司', winner2025: '遠見天下文化出版股份有限公司', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2024臺中特色農產品行銷暨節約能源宣導', amount: '3,500,000', winner2023: 'X', winner2024: '三立電視股份有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2024臺中城市吉祥物推廣行銷及親善活動', amount: '2,400,000', winner2023: '東森電視事業股份有限公司', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2024臺中親子音樂季', amount: '3,000,000', winner2023: '東森電視事業股份有限公司（4年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2024臺中耶誕嘉年華暨水利成果推廣計畫', amount: '14,500,000', winner2023: '聯利媒體股份有限公司', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2025臺中市跨年晚會活動', amount: '15,000,000', winner2023: '群健有線電視股份有限公司（6年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2024臺中國際動漫博覽會', amount: '7,250,000', winner2023: '聯利媒體股份有限公司（4年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2024搖滾臺中音樂節活動', amount: '6,480,000', winner2023: '聯利媒體股份有限公司（5年）', winner2024: '', winner2025: '三立電視股份有限公司', notes: '' },
  { agency: '臺中市政府新聞局', caseName: '2024電影巡迴放映活動', amount: '2,915,000', winner2023: '高碲設計傳播有限公司（5年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府觀光旅遊局', caseName: '2024臺中國際踩舞嘉年華系列活動', amount: '700,000', winner2023: 'X', winner2024: '聯集顧問有限公司', winner2025: '群健有線電視股份有限公司', notes: '' },
  { agency: '臺中市政府觀光旅遊局', caseName: '2025中臺灣元宵燈會', amount: '34,950,000', winner2023: '豪翌廣告材料有限公司', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府觀光旅遊局', caseName: '2024臺中國際花毯節策展', amount: '19,900,000', winner2023: '豪翌廣告材料有限公司（5年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '臺中市政府觀光旅遊局', caseName: '2024臺中國際踩舞嘉年華', amount: '13,859,000', winner2023: '力譔堂整合行銷股份有限公司', winner2024: '群健有線電視股份有限公司', winner2025: '群健有線電視股份有限公司', notes: '' },
  { agency: '臺中市政府觀光旅遊局', caseName: '2024臺中自行車嘉年華', amount: '3,200,000', winner2023: '無限連結有限公司', winner2024: '好事文創行銷有限公司', winner2025: '傑森全球整合行銷股份有限公司', notes: '' },
  { agency: '臺中市政府運動局', caseName: '2024臺中電競嘉年華活動', amount: '5,800,000', winner2023: '大豐有線電視股份有限公司', winner2024: '群健有線電視股份有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市政府環境保護局', caseName: '113年度臺中市環境教育園區宣導活動', amount: '2,980,000', winner2023: '德汰科技顧問有限公司', winner2024: '技佳工程科技股份有限公司', winner2025: '技佳工程科技股份有限公司', notes: '' },
  { agency: '臺中市政府衛生局', caseName: '113年金照獎表揚活動', amount: '1,500,000', winner2023: '聯合報股份有限公司', winner2024: '作好活動有限公司', winner2025: '作好活動有限公司', notes: '' },
  { agency: '臺中市工商發展投資策進會', caseName: '2025第16屆臺中市十大伴手禮票選活動', amount: '1,495,000', winner2023: '高碲設計傳播有限公司（7年）', winner2024: '', winner2025: '', notes: '' },
  { agency: '勞動部勞動力發展署中彰投分署', caseName: '2024中區就業博覽會', amount: '2,611,500', winner2023: '高碲設計傳播有限公司', winner2024: '', winner2025: '', notes: '' },
  { agency: '經濟部水利署', caseName: '113年水利節活動', amount: '4,450,000', winner2023: '橙石策略整合行銷有限公司（5年）', winner2024: '', winner2025: '富基采儷會館', notes: '' },
  { agency: '衛生福利部社會及家庭署', caseName: '114年兒童權利宣導活動', amount: '2,000,000', winner2023: '親子天下股份有限公司', winner2024: '如果國際藝術事業股份有限公司', winner2025: '如果國際藝術事業股份有限公司', notes: '' },
  { agency: '臺中市新社區農會', caseName: '113年度新社花海暨臺中國際花毯節農特產品行銷推廣', amount: '7,000,000', winner2023: 'X', winner2024: '高碲設計傳播有限公司', winner2025: '信福創藝有限公司', notes: '2016-2017：高碲' },
  { agency: '臺中市風景區管理所', caseName: '2024臺中海洋觀光季', amount: '3,498,000', winner2023: '立野整合行銷公關有限公司', winner2024: '定泳文創有限公司', winner2025: 'X', notes: '' },
  { agency: '臺中市家庭教育中心', caseName: '113年臺中市祖父母節系列慶祝活動', amount: '1,000,000', winner2023: '禾果子創意股份有限公司', winner2024: '高碲設計傳播有限公司', winner2025: '瓦當麥可活動整合股份有限公司', notes: '' },
];

async function importData() {
  try {
    const res = await fetch('http://localhost:3001/api/intel/records/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: data }),
    });
    const result = await res.json();
    console.log('匯入結果:', result);

    // 驗證統計
    const stats = await fetch('http://localhost:3001/api/intel/records/stats');
    const s = await stats.json();
    console.log('統計:', s.totalRecords, '筆紀錄');
    console.log('Top 5 廠商:', s.topVendors?.slice(0, 5));
    console.log('固定得標:', s.fixedVendors?.length, '筆');
  } catch (err) {
    console.error('匯入失敗:', err);
  }
}

importData();
