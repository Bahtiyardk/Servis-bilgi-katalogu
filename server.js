const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, 'public'));
const USERNAME = process.env.BASIC_AUTH_USERNAME || 'admin';
const PASSWORD = process.env.BASIC_AUTH_PASSWORD || '43214321';

function unauthorized(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Restricted"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('Yetkisiz erişim');
}

function isAuthorized(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    return false;
  }

  const encodedCredentials = header.slice(6).trim();
  if (!encodedCredentials || !/^[A-Za-z0-9+/=]+$/.test(encodedCredentials)) {
    return false;
  }

  const credentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  const separatorIndex = credentials.indexOf(':');
  if (!credentials || separatorIndex <= 0 || separatorIndex !== credentials.lastIndexOf(':')) {
    return false;
  }

  return credentials === `${USERNAME}:${PASSWORD}`;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
  };

  return contentTypes[ext] || 'application/octet-stream';
}

function resolveFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const pathSegments = decodedPath.split(/[\\/]+/).filter(Boolean);
  if (pathSegments.includes('..')) {
    return null;
  }

  const normalizedPath = path.normalize(decodedPath);
  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(PUBLIC_DIR, relativePath);
  const relativeToPublicDir = path.relative(PUBLIC_DIR, absolutePath);

  if (relativeToPublicDir.startsWith('..') || path.isAbsolute(relativeToPublicDir)) {
    return null;
  }

  return absolutePath;
}

function createServer() {
  return http.createServer((req, res) => {
    if (!isAuthorized(req)) {
      unauthorized(res);
      return;
    }

    const filePath = resolveFilePath(req.url || '/');
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erişim reddedildi');
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Dosya bulunamadı');
        return;
      }

      const finalPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      fs.readFile(finalPath, (readError, data) => {
        if (readError) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Dosya bulunamadı');
          return;
        }

        res.writeHead(200, { 'Content-Type': getContentType(finalPath) });
        res.end(data);
      });
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
}

module.exports = {
  createServer,
  resolveFilePath,
};
