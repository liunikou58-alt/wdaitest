/**
 * 共用驗證規則
 * 用法：const v = require('../shared/validators');
 *       const err = v.validate(v.schemas.customer, req.body);
 *       if (err) return res.status(400).json({ error: err });
 */

const schemas = {
  // == 通用 ==
  login: {
    username: { type: 'string', required: true, min: 2, label: '帳號' },
    password: { type: 'string', required: true, min: 4, label: '密碼' },
  },
  user: {
    username: { type: 'string', required: true, min: 2, label: '帳號' },
    display_name: { type: 'string', required: true, label: '姓名' },
    password: { type: 'string', required: true, min: 4, label: '密碼' },
    role: { type: 'enum', values: ['admin', 'manager', 'planner', 'staff', 'viewer'], label: '角色' },
  },

  // == CRM ==
  customer: {
    name: { type: 'string', required: true, label: '客戶名稱' },
    contact_name: { type: 'string', label: '聯絡人' },
    email: { type: 'email', label: 'Email' },
    phone: { type: 'string', label: '電話' },
  },

  // == 提案 ==
  proposal: {
    title: { type: 'string', required: true, label: '提案名稱' },
    customer_id: { type: 'string', label: '客戶' },
    event_type: { type: 'string', label: '活動類型' },
  },

  // == 合約 ==
  contract: {
    title: { type: 'string', required: true, label: '合約名稱' },
    amount: { type: 'number', min: 0, label: '金額' },
    start_date: { type: 'date', label: '開始日期' },
    end_date: { type: 'date', label: '結束日期' },
  },

  // == 專案 ==
  project: {
    name: { type: 'string', required: true, label: '專案名稱' },
    event_type: { type: 'string', label: '活動類型' },
    budget: { type: 'number', min: 0, label: '預算' },
  },

  // == 任務 ==
  task: {
    title: { type: 'string', required: true, label: '任務名稱' },
    status: { type: 'enum', values: ['todo', 'in_progress', 'done', 'cancelled'], label: '狀態' },
  },

  // == 廠商 ==
  vendor: {
    name: { type: 'string', required: true, label: '廠商名稱' },
    contact_name: { type: 'string', label: '聯絡人' },
    email: { type: 'email', label: 'Email' },
  },

  // == 採購單 ==
  purchaseOrder: {
    vendor_id: { type: 'string', required: true, label: '廠商' },
    total: { type: 'number', min: 0, label: '總金額' },
  },

  // == 財務 ==
  revenue: {
    description: { type: 'string', required: true, label: '說明' },
    amount: { type: 'number', required: true, min: 0, label: '金額' },
  },
  expense: {
    description: { type: 'string', required: true, label: '說明' },
    amount: { type: 'number', required: true, min: 0, label: '金額' },
  },

  // == 排班 ==
  schedule: {
    user_id: { type: 'string', required: true, label: '人員' },
    start_date: { type: 'date', required: true, label: '開始日期' },
    shift: { type: 'enum', values: ['full', 'morning', 'afternoon', 'evening', 'overnight'], label: '班次' },
  },

  // == 知識庫 ==
  knowledge: {
    title: { type: 'string', required: true, label: '標題' },
    category: { type: 'enum', values: ['case_study', 'failure', 'sop', 'template', 'general'], label: '分類' },
  },

  // == 資產 ==
  asset: {
    name: { type: 'string', required: true, label: '設備名稱' },
    quantity: { type: 'number', min: 1, label: '數量' },
  },

  // == 清單 ==
  checklist: {
    title: { type: 'string', required: true, label: '清單名稱' },
    type: { type: 'enum', values: ['execution', 'load_in', 'load_out', 'safety', 'other'], label: '類型' },
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function validate(schema, data) {
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const val = data[field];
    const label = rules.label || field;

    if (rules.required && (val === undefined || val === null || val === '')) {
      errors.push(`${label} 為必填`);
      continue;
    }
    if (val === undefined || val === null || val === '') continue;

    if (rules.type === 'string' && typeof val !== 'string') errors.push(`${label} 必須是文字`);
    if (rules.type === 'number' && (typeof val !== 'number' || isNaN(val))) errors.push(`${label} 必須是數字`);
    if (rules.type === 'email' && !EMAIL_RE.test(val)) errors.push(`${label} 格式不正確`);
    if (rules.type === 'date' && !DATE_RE.test(val)) errors.push(`${label} 日期格式不正確`);
    if (rules.type === 'enum' && rules.values && !rules.values.includes(val)) errors.push(`${label} 值不合法`);

    if (rules.min !== undefined) {
      if (rules.type === 'string' && val.length < rules.min) errors.push(`${label} 至少 ${rules.min} 個字`);
      if (rules.type === 'number' && val < rules.min) errors.push(`${label} 不得小於 ${rules.min}`);
    }
    if (rules.max !== undefined) {
      if (rules.type === 'string' && val.length > rules.max) errors.push(`${label} 不得超過 ${rules.max} 個字`);
      if (rules.type === 'number' && val > rules.max) errors.push(`${label} 不得大於 ${rules.max}`);
    }
  }
  return errors.length ? errors.join('；') : null;
}

// Express middleware factory
function validateBody(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();
    const err = validate(schema, req.body);
    if (err) return res.status(400).json({ error: err, validation: true });
    next();
  };
}

module.exports = { schemas, validate, validateBody };
