import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

export class StepsEngine {
  constructor(cfg = {}) {
    this.API_KEY = cfg.apiKey || process.env.API_KEY || 'iot-secret'
    this.MAX_CONCURRENCY = Number(cfg.maxConcurrency ?? process.env.MAX_CONCURRENCY ?? 100)
    this.DEFAULT_TIMEOUT_MS = Number(cfg.defaultTimeoutMs ?? 30000)
    this.IDEMP_TTL = Number(cfg.idempotencyTTLms ?? 30000)
    this.active = 0
    this.queue = []
    this.recent = new Map()
    this.currentState = 'WAITING'
    this.stepLogs = []
    this.sseClients = new Set()
  }

  getState() { return this.currentState }
  getLogs() { return this.stepLogs.slice() }
  now() { return Date.now() }

  cleanupRecent() {
    const t = this.now()
    for (const [k, v] of this.recent.entries()) {
      if (t - v.ts > this.IDEMP_TTL) this.recent.delete(k)
    }
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject })
      this.processQueue()
    })
  }

  processQueue() {
    while (this.active < this.MAX_CONCURRENCY && this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift()
      this.active++
      Promise.resolve()
        .then(fn)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.active--
          this.processQueue()
        })
    }
  }

  async readJSON(p) {
    const data = await fs.readFile(p, 'utf-8')
    return JSON.parse(data)
  }

  async fileExists(p) {
    try {
      await fs.access(p)
      return true
    } catch {
      return false
    }
  }

  logStep(id, step, ok, details) {
    this.stepLogs.push({ id, step, ok, details, ts: new Date().toISOString() })
  }

  broadcast(step) {
    const payload = JSON.stringify({ state: this.currentState, step, ts: Date.now() })
    for (const res of this.sseClients) {
      res.write(`data: ${payload}\n\n`)
    }
  }

  baseRoot() {
    const cwd = process.cwd()
    return path.resolve(cwd, '..')
  }

  async step1(id) {
    const root = this.baseRoot()
    const metaPath = path.join(root, 'frontend', 'metadata.json')
    const bgmPath = path.join(root, 'frontend', 'public', 'sounds', 'bgm.mp3')
    const s1 = path.join(root, 'frontend', 'public', 'sounds', 'step1.mp3')
    const s2 = path.join(root, 'frontend', 'public', 'sounds', 'step2.mp3')
    const s3 = path.join(root, 'frontend', 'public', 'sounds', 'step3.mp3')
    const meta = await this.readJSON(metaPath)
    const exists = await Promise.all([bgmPath, s1, s2, s3].map((p) => this.fileExists(p)))
    const ok = exists.every(Boolean) && !!meta
    if (!ok) throw new Error('资源或配置缺失')
    this.logStep(id, 'step1', true, { resources: ['bgm.mp3', 'step1.mp3', 'step2.mp3', 'step3.mp3'], configKeys: Object.keys(meta) })
    return { initialized: true }
  }

  async step2(id) {
    const root = this.baseRoot()
    const metaPath = path.join(root, 'frontend', 'metadata.json')
    const meta = await this.readJSON(metaPath)
    const keys = Object.keys(meta)
    const transformed = keys.reduce((acc, k) => {
      const v = meta[k]
      acc[k.toUpperCase()] = typeof v === 'string' ? v.toUpperCase() : v
      return acc
    }, {})
    const hash = crypto.createHash('sha256').update(JSON.stringify(transformed)).digest('hex')
    this.logStep(id, 'step2', true, { hash, count: keys.length })
    return { processed: true, hash }
  }

  async step3(id) {
    this.currentState = 'LAUNCHING'
    const result = { state: this.currentState }
    this.logStep(id, 'step3', true, result)
    this.broadcast('step3')
    return { finalized: true, state: this.currentState }
  }

  async reset() {
    this.currentState = 'WAITING'
    this.broadcast('reset')
    return { reset: true, state: this.currentState }
  }

  async runStepsInternal(id, steps, atomic, timeoutMs) {
    const exec = async () => {
      const snapshotState = this.currentState
      const results = []
      try {
        for (const s of steps) {
          if (s === 'step1') {
            const r = await this.step1(id)
            results.push({ step: s, ok: true, result: r })
            this.currentState = 'WAVE_DETECTED'
            this.broadcast('step1')
          } else if (s === 'step2') {
            const r = await this.step2(id)
            results.push({ step: s, ok: true, result: r })
            this.currentState = 'HEART_DETECTED'
            this.broadcast('step2')
          } else if (s === 'step3') {
            const r = await this.step3(id)
            results.push({ step: s, ok: true, result: r })
          } else {
            throw new Error('无效步骤')
          }
        }
        return { ok: true, results }
      } catch (e) {
        if (atomic) this.currentState = snapshotState
        return { ok: false, error: String(e?.message ?? e), results }
      }
    }
    return Promise.race([
      exec(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('执行超时')), timeoutMs)),
    ])
  }

  async handleTrigger(input) {
    const apiKeyHeader = input.headers['x-api-key'] || input.headers['X-API-Key']
    if (apiKeyHeader !== this.API_KEY) {
      return { statusCode: 401, status: 'error', error: '未授权' }
    }
    const idKey = input.headers['x-idempotency-key'] || input.headers['X-Idempotency-Key'] || crypto.randomUUID()
    this.cleanupRecent()
    const existing = this.recent.get(idKey)
    if (existing?.done) {
      return existing.response
    }
    const body = input.body || {}
    const step = body.step
    const steps = Array.isArray(body.steps) ? body.steps : step ? [step] : []
    const atomic = Boolean(body.atomic)
    const timeoutMs = Math.min(Number(body.timeoutMs || this.DEFAULT_TIMEOUT_MS), 60000)
    if (!steps.length || !steps.every((s) => ['step1', 'step2', 'step3'].includes(s))) {
      return { statusCode: 400, status: 'error', error: '步骤参数无效' }
    }
    this.recent.set(idKey, { ts: this.now(), done: false })
    try {
      const r = await this.enqueue(() => this.runStepsInternal(idKey, steps, atomic, timeoutMs))
      const resp =
        r.ok
          ? { statusCode: 200, status: 'success', results: r.results, state: this.getState(), requestId: idKey }
          : { statusCode: 500, status: 'error', error: r.error, results: r.results, state: this.getState(), requestId: idKey }
      this.recent.set(idKey, { ts: this.now(), done: true, response: resp })
      return resp
    } catch {
      const resp = { statusCode: 504, status: 'error', error: '执行超时', state: this.getState(), requestId: idKey }
      this.recent.set(idKey, { ts: this.now(), done: true, response: resp })
      return resp
    }
  }

  async handleNodeRequest(req, res) {
    const sendJson = (code, data) => {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-API-Key,X-Idempotency-Key',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      })
      res.end(JSON.stringify(data))
    }
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (req.method === 'OPTIONS') {
      sendJson(200, { ok: true })
      return
    }
    if (url.pathname === '/api/steps/sse' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      this.sseClients.add(res)
      res.write(`data: ${JSON.stringify({ state: this.getState(), ts: Date.now() })}\n\n`)
      req.on('close', () => {
        this.sseClients.delete(res)
      })
      return
    }
    if (url.pathname === '/api/steps/state' && req.method === 'GET') {
      sendJson(200, { state: this.getState(), logs: this.getLogs() })
      return
    }
    if (url.pathname === '/api/steps/reset' && req.method === 'POST') {
      const headers = req.headers
      const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key']
      if (apiKeyHeader !== this.API_KEY) {
        sendJson(401, { statusCode: 401, status: 'error', error: '未授权' })
        return
      }
      const resp = await this.reset()
      sendJson(200, { statusCode: 200, status: 'success', ...resp })
      return
    }
    if (url.pathname === '/api/steps/trigger' && req.method === 'POST') {
      const body = await new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8')
            resolve(raw ? JSON.parse(raw) : {})
          } catch (e) {
            reject(e)
          }
        })
        req.on('error', reject)
      }).catch(() => null)
      if (body === null) {
        sendJson(400, { statusCode: 400, status: 'error', error: '参数错误' })
        return
      }
      const resp = await this.handleTrigger({ headers: req.headers, body })
      sendJson(resp.statusCode || 200, resp)
      return
    }
    res.statusCode = 404
    res.end(JSON.stringify({ statusCode: 404, status: 'error', error: '未找到接口' }))
  }
}
