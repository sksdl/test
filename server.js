const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const express = require('express');
const multer = require('multer');

const app = express();
const host = process.env.HOST || '0.0.0.0';
const httpPort = Number(process.env.PORT || 8080);
const httpsPort = Number(process.env.HTTPS_PORT || 8443);
const adminToken = process.env.ADMIN_TOKEN || 'change-me-admin-token';

const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'localhost-cert.pem');
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'localhost-key.pem');
const galleryDataPath = path.join(__dirname, 'data', 'gallery.json');
const uploadsDir = path.join(__dirname, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

function readGallery() {
  return JSON.parse(fs.readFileSync(galleryDataPath, 'utf-8'));
}

function writeGallery(payload) {
  fs.writeFileSync(galleryDataPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function isAdminRequest(req) {
  return req.headers['x-admin-token'] === adminToken;
}

function verifyAdmin(req, res, next) {
  if (!isAdminRequest(req)) {
    return res.status(401).json({ ok: false, message: '관리자 권한이 필요합니다.' });
  }
  return next();
}

function pinHash(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function sanitizeItem(item) {
  const { deletePinHash, ...safe } = item;
  return safe;
}

function removeLocalUploadIfNeeded(target) {
  if (target && target.image && target.image.startsWith('/uploads/')) {
    const localPath = path.join(__dirname, target.image.replace(/^\//, ''));
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('지원하지 않는 이미지 타입입니다.'));
      return;
    }
    cb(null, true);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/gallery', (_req, res) => {
  const payload = readGallery();
  res.json({ ...payload, items: payload.items.map(sanitizeItem) });
});

app.get('/api/admin/verify', verifyAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/gallery/upload', upload.single('image'), (req, res) => {
  try {
    const { title = '', description = '', category = 'General', nickname = '', pin = '' } = req.body;
    if (!req.file) {
      return res.status(400).json({ ok: false, message: '이미지 파일이 필요합니다.' });
    }

    const cleanPin = String(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return res.status(400).json({ ok: false, message: '삭제 비밀번호는 4자리 숫자여야 합니다.' });
    }

    const cleanNickname = String(nickname).trim().slice(0, 24);
    if (!cleanNickname) {
      return res.status(400).json({ ok: false, message: '익명 닉네임을 입력해주세요.' });
    }

    const payload = readGallery();
    const item = {
      id: crypto.randomUUID(),
      title: String(title).trim().slice(0, 80) || req.file.originalname.slice(0, 80),
      description: String(description).trim().slice(0, 240),
      category: String(category).trim().slice(0, 30) || 'General',
      authorNickname: cleanNickname,
      image: `/uploads/${req.file.filename}`,
      createdAt: new Date().toISOString(),
      deletePinHash: pinHash(cleanPin)
    };

    payload.items.unshift(item);
    writeGallery(payload);
    return res.status(201).json({ ok: true, item: sanitizeItem(item) });
  } catch (_error) {
    return res.status(500).json({ ok: false, message: '업로드 처리 중 오류가 발생했습니다.' });
  }
});

app.delete('/api/gallery/:id', (req, res) => {
  const payload = readGallery();
  const target = payload.items.find((item) => item.id === req.params.id);

  if (!target) {
    return res.status(404).json({ ok: false, message: '삭제할 항목을 찾지 못했습니다.' });
  }

  if (!isAdminRequest(req)) {
    const { nickname = '', pin = '' } = req.body || {};
    const cleanNickname = String(nickname).trim();
    const cleanPin = String(pin).trim();

    if (!/^\d{4}$/.test(cleanPin)) {
      return res.status(400).json({ ok: false, message: '삭제 비밀번호는 4자리 숫자여야 합니다.' });
    }

    if (target.authorNickname !== cleanNickname || target.deletePinHash !== pinHash(cleanPin)) {
      return res.status(403).json({ ok: false, message: '닉네임 또는 비밀번호가 일치하지 않습니다.' });
    }
  }

  payload.items = payload.items.filter((item) => item.id !== req.params.id);
  removeLocalUploadIfNeeded(target);
  writeGallery(payload);
  return res.json({ ok: true });
});

app.delete('/api/gallery', verifyAdmin, (req, res) => {
  const payload = readGallery();
  payload.items.forEach(removeLocalUploadIfNeeded);
  payload.items = [];
  writeGallery(payload);
  return res.json({ ok: true, message: '전체 작품 삭제 완료' });
});

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, message: '파일 크기는 8MB 이하여야 합니다.' });
  }
  if (error) {
    return res.status(400).json({ ok: false, message: error.message || '요청 오류' });
  }
  return next();
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, message: 'Not found' });
});

function hasHttpsFiles() {
  return fs.existsSync(certPath) && fs.existsSync(keyPath);
}

if (hasHttpsFiles()) {
  const credentials = {
    cert: fs.readFileSync(certPath, 'utf-8'),
    key: fs.readFileSync(keyPath, 'utf-8')
  };

  https.createServer(credentials, app).listen(httpsPort, host, () => {
    console.log(`✅ HTTPS server running on https://${host}:${httpsPort}`);
  });

  http.createServer((req, res) => {
    const safeHost = (req.headers.host || `localhost:${httpPort}`).split(':')[0];
    const location = `https://${safeHost}:${httpsPort}${req.url}`;
    res.writeHead(301, { Location: location });
    res.end();
  }).listen(httpPort, host, () => {
    console.log(`↪ HTTP redirect server running on http://${host}:${httpPort}`);
  });
} else {
  http.createServer(app).listen(httpPort, host, () => {
    console.log('⚠️ HTTPS certificate not found.');
    console.log(`HTTP server running on http://${host}:${httpPort}`);
    console.log('To enable HTTPS, provide SSL_CERT_PATH and SSL_KEY_PATH or place certs in ./certs/');
  });
}
