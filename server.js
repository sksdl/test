const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');

const app = express();
const host = process.env.HOST || '0.0.0.0';
const httpPort = Number(process.env.PORT || 8080);
const httpsPort = Number(process.env.HTTPS_PORT || 8443);

const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'localhost-cert.pem');
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'localhost-key.pem');

const galleryDataPath = path.join(__dirname, 'data', 'gallery.json');

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/gallery', (_req, res) => {
  const payload = JSON.parse(fs.readFileSync(galleryDataPath, 'utf-8'));
  res.json(payload);
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

  http
    .createServer((req, res) => {
      const safeHost = (req.headers.host || `localhost:${httpPort}`).split(':')[0];
      const location = `https://${safeHost}:${httpsPort}${req.url}`;
      res.writeHead(301, { Location: location });
      res.end();
    })
    .listen(httpPort, host, () => {
      console.log(`↪ HTTP redirect server running on http://${host}:${httpPort}`);
    });
} else {
  http.createServer(app).listen(httpPort, host, () => {
    console.log(`⚠️ HTTPS certificate not found.`);
    console.log(`HTTP server running on http://${host}:${httpPort}`);
    console.log('To enable HTTPS, provide SSL_CERT_PATH and SSL_KEY_PATH or place certs in ./certs/');
  });
}
