// Serves the static export (out/) under the GitHub Pages base path, like GitHub Pages does.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const port = Number(process.argv[2] ?? 4173)
const base = process.env.PAGES_BASE_PATH ?? '/myplace'
const root = new URL('../out/', import.meta.url).pathname
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' }

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (!url.pathname.startsWith(base)) return res.writeHead(302, { location: `${base}/` }).end()
  let file = normalize(join(root, decodeURIComponent(url.pathname.slice(base.length))))
  if (!file.startsWith(root)) return res.writeHead(403).end()
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file))
  } catch {
    res.writeHead(404, { 'content-type': 'text/html' }).end(await readFile(join(root, '404.html')).catch(() => 'Not found'))
  }
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}${base}/`))
