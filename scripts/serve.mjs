/** Local-only preview server. Serves the same project prefix as GitHub Pages. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const root = new URL('../docs/', import.meta.url);
const prefix = '/zana-marketplace/';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const file = new URL(pathname.slice(prefix.length) + (pathname.endsWith('/') ? 'index.html' : ''), root);
  if (!file.href.startsWith(root.href)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file.pathname)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4180, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4180/zana-marketplace/'));
