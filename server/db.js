/**
 * ProposalFlow AI 資料庫實例
 * 使用共用 adapter
 */
const path = require('path');
const { createAdapter } = require('../shared/db-adapter');

const db = createAdapter({
  type: process.env.DB_TYPE || 'sqlite',
  dataDir: path.join(__dirname, '..', 'data'),
  connectionString: process.env.DATABASE_URL || '',
  collections: {
    projects: [],
    documents: [],
    analyses: [],
    cost_estimates: [],
    theme_proposals: [],
    highlights: [],
    bid_records: [],
    users: [],
    departments: [],
    project_members: [],
    activity_logs: [],
    comments: [],
    tasks: [],
    task_attachments: [],
    task_comments: [],
    text_requirements: [],
    selected_sub_activities: [],
    plan_summaries: [],
    style_keywords: [],
    saved_bids: [],
    external_accounts: [],
    tracking_keywords: [],
    competitor_companies: [],
    award_history: [],
    competitor_records: [],
    evaluation_criteria: [],
    ai_chat_history: [],
    dept_intelligence: [],
    proposal_writing: []
  }
});

module.exports = db;
