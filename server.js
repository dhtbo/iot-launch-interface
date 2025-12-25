import http from 'http'
import { StepsEngine } from './services/stepsEngine.js'
import fs from 'fs/promises'
import path from 'path'

const engine = new StepsEngine()

const getMime = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html': return 'text/html'
    case '.js': return 'application/javascript'
    case '.css': return 'text/css'
    case '.json': return 'application/json'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.svg': return 'image/svg+xml'
    case '.ico': return 'image/x-icon'
    case '.mp3': return 'audio/mpeg'
    case '.wav': return 'audio/wav'
    default: return 'application/octet-stream'
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  if (url.pathname.startsWith('/api/')) {
    await engine.handleNodeRequest(req, res)
    return
  }
  const distDir = path.join(process.cwd(), 'dist')
  const filePath = url.pathname === '/' ? path.join(distDir, 'index.html') : path.join(distDir, url.pathname)
  try {
    const data = await fs.readFile(filePath)
    res.writeHead(200, { 'Content-Type': getMime(filePath) })
    res.end(data)
  } catch {
    try {
      const data = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(data)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    }
  }
})

const port = Number(process.env.PORT || 3000)
server.listen(port, () => {
  process.stdout.write(`Server listening on http://localhost:${port}\n`)
})
