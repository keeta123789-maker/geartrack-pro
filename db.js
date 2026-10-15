const { Pool } = require('pg');

// ตั้งค่าการเชื่อมต่อ PostgreSQL บน Supabase
const pool = new Pool({
  connectionString: 'postgresql://postgres:keeta252625@db.dfuopqsleqtuxoespsdw.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;