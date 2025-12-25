import http from 'http'
import { StepsEngine } from './services/stepsEngine.js'

const engine = new StepsEngine()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  if (url.pathname.startsWith('/api/')) {
    await engine.handleNodeRequest(req, res)
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('API server')
})

const port = Number(process.env.PORT || 3002)
server.listen(port, () => {
  process.stdout.write(`Server listening on http://localhost:${port}\n`)
})
