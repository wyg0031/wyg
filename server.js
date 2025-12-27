const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

initDatabase();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'img')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '无效的令牌' });
    }
    req.user = user;
    next();
  });
}

app.post('/api/login', (req, res) => {
  const { id_card, password } = req.body;

  db.get('SELECT * FROM users WHERE id_card = ?', [id_card], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: '认证错误' });
      }

      if (!result) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const token = jwt.sign(
        { id: user.id, id_card: user.id_card, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          id_card: user.id_card,
          name: user.name,
          role: user.role,
          avatar: user.avatar
        }
      });
    });
  });
});

app.post('/api/register', (req, res) => {
  const { id_card, password, name, registration_code } = req.body;

  db.get('SELECT * FROM registration_codes WHERE code = ? AND used = 0', [registration_code], (err, code) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!code) {
      return res.status(400).json({ error: '无效的注册码' });
    }

    db.get('SELECT * FROM users WHERE id_card = ?', [id_card], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (existingUser) {
        return res.status(400).json({ error: '该身份证号已被注册' });
      }

      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          return res.status(500).json({ error: '密码加密失败' });
        }

        db.run('INSERT INTO users (id_card, password, name, role) VALUES (?, ?, ?, ?)',
          [id_card, hashedPassword, name, 'user'],
          function(err) {
            if (err) {
              return res.status(500).json({ error: '注册失败' });
            }

            db.run('UPDATE registration_codes SET used = 1 WHERE id = ?', [code.id], (err) => {
              if (err) {
                console.error('标记注册码已使用失败:', err);
              }
            });

            res.json({ message: '注册成功' });
          }
        );
      });
    });
  });
});

app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM members', (err, memberResult) => {
    if (err) return res.status(500).json({ error: '数据库错误' });

    db.get('SELECT COUNT(*) as count FROM activities', (err, activityResult) => {
      if (err) return res.status(500).json({ error: '数据库错误' });

      db.get('SELECT COUNT(*) as count FROM volunteers', (err, volunteerResult) => {
        if (err) return res.status(500).json({ error: '数据库错误' });

        res.json({
          memberCount: memberResult.count,
          activityCount: activityResult.count,
          volunteerCount: volunteerResult.count
        });
      });
    });
  });
});

app.get('/api/members', authenticateToken, (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM members';
  let params = [];

  if (search) {
    query += ' WHERE name LIKE ? OR id_card LIKE ? OR member_number LIKE ?';
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

app.post('/api/members', authenticateToken, (req, res) => {
  const { name, gender, id_card, birth_date, ethnicity, phone, political_status, member_number, join_date } = req.body;

  db.run(`INSERT INTO members (name, gender, id_card, birth_date, ethnicity, phone, political_status, member_number, join_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, gender, id_card, birth_date, ethnicity, phone, political_status, member_number, join_date],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '添加失败: ' + err.message });
      }
      res.json({ message: '添加成功', id: this.lastID });
    }
  );
});

app.post('/api/members/batch', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let successCount = 0;
    let errorCount = 0;

    data.forEach(row => {
      const birthDateStr = row['出生年月'] ? row['出生年月'].toString() : '';
      let formattedBirthDate = birthDateStr;

      if (birthDateStr.length === 8) {
        const year = birthDateStr.substring(0, 4);
        const month = birthDateStr.substring(4, 6);
        const day = birthDateStr.substring(6, 8);
        formattedBirthDate = `${year}年${parseInt(month)}月${parseInt(day)}日`;
      }

      const joinDateStr = row['入团时间'] ? row['入团时间'].toString() : '';
      let formattedJoinDate = joinDateStr;

      if (joinDateStr.includes('-')) {
        const parts = joinDateStr.split('-');
        if (parts.length === 2) {
          formattedJoinDate = `${parts[0]}年${parseInt(parts[1])}月`;
        }
      }

      const sql = `INSERT INTO members (name, gender, id_card, birth_date, ethnicity, phone, political_status, member_number, join_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [
        row['姓名'],
        row['性别'],
        row['身份证号'],
        formattedBirthDate,
        row['民族'],
        row['手机号码'],
        row['政治面貌'],
        row['团员发展编号'],
        formattedJoinDate
      ], function(err) {
        if (err) {
          errorCount++;
        } else {
          successCount++;
        }
      });
    });

    fs.unlinkSync(req.file.path);
    res.json({ message: `批量导入完成，成功: ${successCount}，失败: ${errorCount}` });
  } catch (error) {
    res.status(500).json({ error: '文件解析失败: ' + error.message });
  }
});

app.delete('/api/members/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM members WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    res.json({ message: '删除成功' });
  });
});

app.get('/api/activities', authenticateToken, (req, res) => {
  const { search } = req.query;
  let query = `SELECT a.*, 
                (SELECT COUNT(*) FROM activity_participants WHERE activity_id = a.id) as participant_count
                FROM activities a`;
  let params = [];

  if (search) {
    query += ' WHERE a.name LIKE ? OR a.location LIKE ?';
    params = [`%${search}%`, `%${search}%`];
  }

  query += ' ORDER BY a.start_time DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

app.get('/api/activities/:id/participants', authenticateToken, (req, res) => {
  db.all('SELECT * FROM activity_participants WHERE activity_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

app.post('/api/activities', authenticateToken, (req, res) => {
  const { name, location, start_time, end_time, duration, remarks, participants } = req.body;

  db.run(`INSERT INTO activities (name, location, start_time, end_time, duration, remarks)
          VALUES (?, ?, ?, ?, ?, ?)`,
    [name, location, start_time, end_time, duration, remarks],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '添加活动失败: ' + err.message });
      }

      const activityId = this.lastID;

      if (participants && participants.length > 0) {
        const stmt = db.prepare('INSERT INTO activity_participants (activity_id, name) VALUES (?, ?)');
        participants.forEach(name => {
          stmt.run(activityId, name);
        });
        stmt.finalize();
      }

      res.json({ message: '添加成功', id: activityId });
    }
  );
});

app.post('/api/activities/:id/participants', authenticateToken, (req, res) => {
  const { participants } = req.body;

  db.run('DELETE FROM activity_participants WHERE activity_id = ?', [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: '更新参与者失败' });
    }

    if (participants && participants.length > 0) {
      const stmt = db.prepare('INSERT INTO activity_participants (activity_id, name) VALUES (?, ?)');
      participants.forEach(name => {
        stmt.run(req.params.id, name);
      });
      stmt.finalize();
    }

    res.json({ message: '更新成功' });
  });
});

app.post('/api/activities/batch-participants', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let successCount = 0;
    let errorCount = 0;

    data.forEach(row => {
      db.get('SELECT id FROM activities WHERE name = ?', [row['活动名称']], (err, activity) => {
        if (err || !activity) {
          errorCount++;
          return;
        }

        db.run('INSERT INTO activity_participants (activity_id, name) VALUES (?, ?)',
          [activity.id, row['姓名']],
          function(err) {
            if (err) {
              errorCount++;
            } else {
              successCount++;
            }
          }
        );
      });
    });

    fs.unlinkSync(req.file.path);
    res.json({ message: `批量导入完成，成功: ${successCount}，失败: ${errorCount}` });
  } catch (error) {
    res.status(500).json({ error: '文件解析失败: ' + error.message });
  }
});

app.delete('/api/activities/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM activities WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    res.json({ message: '删除成功' });
  });
});

app.get('/api/volunteers', authenticateToken, (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM volunteers';
  let params = [];

  if (search) {
    query += ' WHERE name LIKE ? OR id_card LIKE ?';
    params = [`%${search}%`, `%${search}%`];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

app.post('/api/volunteers/batch', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let successCount = 0;
    let errorCount = 0;

    data.forEach(row => {
      const sql = `INSERT INTO volunteers (name, gender, id_card, birth_date, ethnicity, phone, address, volunteer_hours)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [
        row['姓名'] || '',
        row['性别'] || '',
        row['身份证号'] || '',
        row['出生年月'] || '',
        row['民族'] || '',
        row['手机号码'] || '',
        row['地址'] || '',
        row['志愿时长'] || 0
      ], function(err) {
        if (err) {
          errorCount++;
        } else {
          successCount++;
        }
      });
    });

    fs.unlinkSync(req.file.path);
    res.json({ message: `批量导入完成，成功: ${successCount}，失败: ${errorCount}` });
  } catch (error) {
    res.status(500).json({ error: '文件解析失败: ' + error.message });
  }
});

app.delete('/api/volunteers/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM volunteers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    res.json({ message: '删除成功' });
  });
});

app.get('/api/search', authenticateToken, (req, res) => {
  const { q } = req.query;

  db.all(`SELECT * FROM members WHERE name LIKE ? OR id_card LIKE ? OR member_number LIKE ?`,
    [`%${q}%`, `%${q}%`, `%${q}%`],
    (err, members) => {
      if (err) return res.status(500).json({ error: '数据库错误' });

      db.all(`SELECT * FROM activities WHERE name LIKE ? OR location LIKE ?`,
        [`%${q}%`, `%${q}%`],
        (err, activities) => {
          if (err) return res.status(500).json({ error: '数据库错误' });

          db.all(`SELECT * FROM volunteers WHERE name LIKE ? OR id_card LIKE ?`,
            [`%${q}%`, `%${q}%`],
            (err, volunteers) => {
              if (err) return res.status(500).json({ error: '数据库错误' });

              res.json({ members, activities, volunteers });
            }
          );
        }
      );
    }
  );
});

app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  db.all('SELECT id, id_card, name, role, avatar, created_at FROM users', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

app.post('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const { id_card, password, name, role } = req.body;

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: '密码加密失败' });
    }

    db.run('INSERT INTO users (id_card, password, name, role) VALUES (?, ?, ?, ?)',
      [id_card, hashedPassword, name, role],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '添加失败' });
        }
        res.json({ message: '添加成功', id: this.lastID });
      }
    );
  });
});

app.put('/api/users/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, password, role } = req.body;

  if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: '权限不足' });
  }

  if (password) {
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ error: '密码加密失败' });
      }

      const query = req.user.role === 'admin'
        ? 'UPDATE users SET name = ?, password = ?, role = ? WHERE id = ?'
        : 'UPDATE users SET name = ?, password = ? WHERE id = ?';

      const params = req.user.role === 'admin'
        ? [name, hashedPassword, role, id]
        : [name, hashedPassword, id];

      db.run(query, params, function(err) {
        if (err) {
          return res.status(500).json({ error: '更新失败' });
        }
        res.json({ message: '更新成功' });
      });
    });
  } else {
    const query = req.user.role === 'admin'
      ? 'UPDATE users SET name = ?, role = ? WHERE id = ?'
      : 'UPDATE users SET name = ? WHERE id = ?';

    const params = req.user.role === 'admin'
      ? [name, role, id]
      : [name, id];

    db.run(query, params, function(err) {
      if (err) {
        return res.status(500).json({ error: '更新失败' });
      }
      res.json({ message: '更新成功' });
    });
  }
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  if (req.user.id === parseInt(req.params.id)) {
    return res.status(400).json({ error: '不能删除自己的账号' });
  }

  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    res.json({ message: '删除成功' });
  });
});

app.get('/api/registration-codes', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  db.all('SELECT * FROM registration_codes ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

app.post('/api/registration-codes', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const { code } = req.body;

  db.run('INSERT INTO registration_codes (code) VALUES (?)', [code], function(err) {
    if (err) {
      return res.status(500).json({ error: '添加失败' });
    }
    res.json({ message: '添加成功', id: this.lastID });
  });
});

app.delete('/api/registration-codes/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  db.run('DELETE FROM registration_codes WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    res.json({ message: '删除成功' });
  });
});

app.get('/api/export/members', authenticateToken, (req, res) => {
  const { ids } = req.query;
  let query = 'SELECT * FROM members';
  let params = [];

  if (ids) {
    const idList = ids.split(',').map(id => parseInt(id));
    query += ' WHERE id IN (' + idList.map(() => '?').join(',') + ')';
    params = idList;
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '团员信息');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=members.xlsx');
    res.send(buffer);
  });
});

app.get('/api/export/word', authenticateToken, async (req, res) => {
  const { type, id } = req.query;

  try {
    let rows = [];
    let title = '';

    if (type === 'member') {
      await new Promise((resolve, reject) => {
        db.get('SELECT * FROM members WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else {
            rows = [row];
            title = '团员信息';
            resolve();
          }
        });
      });
    } else if (type === 'volunteer') {
      await new Promise((resolve, reject) => {
        db.get('SELECT * FROM volunteers WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else {
            rows = [row];
            title = '志愿者信息';
            resolve();
          }
        });
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: '未找到数据' });
    }

    const data = rows[0];
    const tableRows = Object.entries(data).map(([key, value]) => {
      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(key)],
            width: { size: 30, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph(value ? value.toString() : '')],
            width: { size: 70, type: WidthType.PERCENTAGE },
          }),
        ],
      });
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: title,
              heading: 'Heading1',
              spacing: { after: 200 },
            }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('字段')],
                      width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph('值')],
                      width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                ...tableRows,
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=${title}.docx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: '导出失败: ' + error.message });
  }
});

app.get('/api/export/activity-participants', authenticateToken, (req, res) => {
  const { activityId } = req.query;

  db.all(`SELECT ap.*, a.name as activity_name FROM activity_participants ap
          JOIN activities a ON ap.activity_id = a.id
          WHERE ap.activity_id = ?`, [activityId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '活动参与人员');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=activity-participants.xlsx');
    res.send(buffer);
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
