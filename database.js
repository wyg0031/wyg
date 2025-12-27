const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_card TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      id_card TEXT UNIQUE NOT NULL,
      birth_date TEXT NOT NULL,
      ethnicity TEXT NOT NULL,
      phone TEXT NOT NULL,
      political_status TEXT NOT NULL,
      member_number TEXT NOT NULL,
      join_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration REAL NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS activity_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      id_card TEXT UNIQUE NOT NULL,
      birth_date TEXT NOT NULL,
      ethnicity TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      volunteer_hours REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS registration_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      used BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const userPassword = bcrypt.hashSync('290031', 10);
    
    db.run(`INSERT OR IGNORE INTO users (id_card, password, name, role) 
            VALUES ('admin', ?, '超级管理员', 'admin')`, [hashedPassword], (err) => {
      if (err) {
        console.error('创建默认管理员失败:', err);
      } else {
        console.log('数据库初始化完成，默认管理员账号: admin / admin123');
      }
    });

    db.run(`INSERT OR IGNORE INTO users (id_card, password, name, role) 
            VALUES ('522425200601290031', ?, '普通用户', 'user')`, [userPassword], (err) => {
      if (err) {
        console.error('创建用户失败:', err);
      } else {
        console.log('用户账号创建成功: 522425200601290031 / 290031');
      }
    });

    db.run(`INSERT OR IGNORE INTO registration_codes (code) VALUES ('REG2024')`);
    db.run(`INSERT OR IGNORE INTO registration_codes (code) VALUES ('REG2025')`);
  });
}

module.exports = { db, initDatabase };
