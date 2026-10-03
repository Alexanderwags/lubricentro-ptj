// Vista local: node preview-server.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8'
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, contents) => {
    if (error) {
      response.writeHead(404).end('No encontrado');
      return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(contents);
  });
}).listen(8765, '127.0.0.1');
