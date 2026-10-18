// Serves the built site the way Vercel will: same headers from vercel.json,
// so the tests catch anything the Content-Security-Policy would block.
// node scripts/serve.mjs [port]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve('dist');
const port = Number(process.argv[2] ?? 4180);
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.txt': 'text/plain' };

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return res.writeHead(400).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end('not found');
    for (const rule of config.headers) {
      const re = new RegExp(`^${rule.source.replace('(.*)', '.*')}$`);
      if (re.test(url.pathname)) for (const h of rule.headers) res.setHeader(h.key, h.value);
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`serving dist on http://localhost:${port}`));
