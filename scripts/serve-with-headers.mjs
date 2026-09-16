#!/usr/bin/env node
// Serves dist/ locally with the headers declared in render.yaml, so tests assert what the host will send.
// Usage: node scripts/serve-with-headers.mjs [port]   (default 4321)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dist = join(root, 'dist');
const port = Number(process.argv[2] || 4321);
const blueprint = yamlLoad(readFileSync(join(root, 'render.yaml'), 'utf8'));
const service = blueprint.services.find((s) => s.name === 'cloelia-site-staging') || blueprint.services[0];
const headers = service.headers || [];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function matches(pattern, path) {
  if (pattern === '/*') return true;
  if (pattern.endsWith('/*')) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let path = decodeURIComponent(url.pathname);
  let file = join(dist, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { file = join(dist, '404.html'); res.statusCode = 404; }
  const body = readFileSync(file);
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  for (const h of headers) if (matches(h.path, path)) res.setHeader(h.name, h.value);
  res.end(body);
}).listen(port, () => console.log(`serving dist/ with ${service.name} headers on http://localhost:${port}/`));
