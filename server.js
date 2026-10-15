const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ตั้งค่าการเชื่อมต่อ PostgreSQL บน Supabase
const pool = new Pool({
  connectionString: 'postgresql://postgres:keeta252625@db.dfuopqsleqtuxoespsdw.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ตั้งค่าให้เสิร์ฟไฟล์หน้าเว็บจากโฟลเดอร์โปรเจกต์โดยตรง
app.use(express.static(path.join(__dirname)));

// Route สำหรับหน้าแรก
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API ดึงข้อมูลอุปกรณ์ทั้งหมด
app.get('/api/equipment', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM equipment ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Database Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// API เพิ่มอุปกรณ์แบบกลุ่ม (Bulk) รันตัวเลขเรียงลำดับตามตัวย่อ (เช่น XLR-001, XLR-002)
app.post('/api/equipment/bulk', async (req, res) => {
  let requestData = req.body;
  
  let items = [];
  if (Array.isArray(requestData)) {
    items = requestData;
  } else {
    items = requestData.items || requestData.data || [requestData];
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
  }

  try {
    for (let item of items) {
      const name = item.name || item.equipment_name || 'อุปกรณ์ไม่ระบุชื่อ';
      const status = item.status || 'AVAILABLE';
      
      // ดึงตัวย่อรหัส (Prefix) ที่ผู้ใช้เลือก (เช่น XLR, MIC, LED)
      let prefix = item.prefix || item.category || item.code_prefix || 'GEAR';
      prefix = prefix.trim().toUpperCase();

      let quantity = parseInt(item.quantity || item.qty || 1);
      if (isNaN(quantity) || quantity < 1) quantity = 1;

      // เช็กจำนวนอุปกรณ์ที่มีตัวย่อนี้ในฐานข้อมูลแล้ว เพื่อรันเลขต่อจากของเดิม
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM equipment WHERE asset_code LIKE $1',
        [`${prefix}-%`]
      );
      let nextNum = parseInt(countResult.rows[0].count) + 1;

      // วนลูปสร้างรหัสเรียงลำดับ (เช่น 001, 002, 003...)
      for (let i = 0; i < quantity; i++) {
        const currentNum = nextNum + i;
        const paddedNum = String(currentNum).padStart(3, '0'); // จัดรูปให้เป็น 3 หลัก (เช่น 001)
        let assetCode = `${prefix}-${paddedNum}`;

        await pool.query(
          `INSERT INTO equipment (asset_code, name, status) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (asset_code) 
           DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status`,
          [assetCode, name, status]
        );
      }
    }
    res.json({ success: true, message: 'นำเข้าข้อมูลสำเร็จและรันเลขเรียงลำดับเรียบร้อย' });
  } catch (err) {
    console.error('Database Error Detail:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API ดึงข้อมูลงาน (Jobs)
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

// API สแกนคืนของอัตโนมัติ
app.post('/api/return', async (req, res) => {
  const { asset_code } = req.body;
  try {
    const result = await pool.query(
      'UPDATE equipment SET status = $1 WHERE asset_code = $2 RETURNING *',
      ['AVAILABLE', asset_code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์นี้ในระบบ' });
    }
    
    res.json({ success: true, message: 'คืนอุปกรณ์สำเร็จ!', data: result.rows[0] });
  } catch (err) {
    console.error('Database Error:', err.message);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});