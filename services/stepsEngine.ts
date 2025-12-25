import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

export interface EngineConfig {
  apiKey?: string
  maxConcurrency?: number
  defaultTimeoutMs?: number
  idempotencyTTLms?: number
}

export class StepsEngine {
  private API_KEY: string
  private MAX_CONCURRENCY: number
  private DEFAULT_TIMEOUT_MS: number
  private IDEMP_TTL: number

  private active = 0
  private queue: Array<{ fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }> = []
  private recent = new Map<string, { ts: number; done?: boolean; response?: any }>()
  private currentState = 'WAITING'
  private stepLogs: Array<{ id: string; step: string; ok: boolean; details: any; ts: string }> = []
  private sseClients = new Set<ServerResponse>()

  constructor(cfg: EngineConfig = {}) {
    this.API_KEY = cfg.apiKey || process.env.API_KEY || 'iot-secret'
    this.MAX_CONCURRENCY = Number(cfg.maxConcurrency ?? process.env.MAX_CONCURRENCY ?? 100)
    this.DEFAULT_TIMEOUT_MS = Number(cfg.defaultTimeoutMs ?? 30000)
    this.IDEMP_TTL = Number(cfg.idempotencyTTLms ?? 30000)
  }

  getState() {
    return this.currentState
  }

  getLogs() {
    return this.stepLogs.slice()
  }

  private now() {
    return Date.now()
  }

  private cleanupRecent() {
    const t = this.now()
    for (const [k, v] of this.recent.entries()) {
      if (t - v.ts > this.IDEMP_TTL) this.recent.delete(k)
    }
  }

  private enqueue<T>(fn: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject })
      this.processQueue()
    })
  }

  private processQueue() {
    while (this.active < this.MAX_CONCURRENCY && this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift()!
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

  private async readJSON(p: string) {
    const data = await fs.readFile(p, 'utf-8')
    return JSON.parse(data)
  }

  private async fileExists(p: string) {
    try {
      await fs.access(p)
      return true
    } catch {
      return false
    }
  }

  private logStep(id: string, step: string, ok: boolean, details: any) {
    this.stepLogs.push({ id, step, ok, details, ts: new Date().toISOString() })
  }

  private broadcast(step?: string) {
    const payload = JSON.stringify({ state: this.currentState, step, ts: Date.now() })
    for (const res of this.sseClients) {
      res.write(`data: ${payload}\n\n`)
    }
  }

  private async step1(id: string) {
    const root = process.cwd()
    const metaPath = path.join(root, 'metadata.json')
    const bgmPath = path.join(root, 'public', 'sounds', 'bgm.mp3')
    const s1 = path.join(root, 'public', 'sounds', 'step1.mp3')
    const s2 = path.join(root, 'public', 'sounds', 'step2.mp3')
    const s3 = path.join(root, 'public', 'sounds', 'step3.mp3')
    const meta = await this.readJSON(metaPath)
    const exists = await Promise.all([bgmPath, s1, s2, s3].map((p) => this.fileExists(p)))
    const ok = exists.every(Boolean) && !!meta
    if (!ok) throw new Error('资源或配置缺失')
    this.logStep(id, 'step1', true, { resources: ['bgm.mp3', 'step1.mp3', 'step2.mp3', 'step3.mp3'], configKeys: Object.keys(meta) })
    return { initialized: true }
  }

  private async step2(id: string) {
    const root = process.cwd()
    const metaPath = path.join(root, 'metadata.json')
    const meta = await this.readJSON(metaPath)
    const keys = Object.keys(meta)
    const transformed = keys.reduce((acc: any, k) => {
      const v = (meta as any)[k]
      acc[k.toUpperCase()] = typeof v === 'string' ? (v as string).toUpperCase() : v
      return acc
    }, {})
    const hash = crypto.createHash('sha256').update(JSON.stringify(transformed)).digest('hex')
    this.logStep(id, 'step2', true, { hash, count: keys.length })
    return { processed: true, hash }
  }

  private async step3(id: string) {
    this.currentState = 'LAUNCHING'
    const result = { state: this.currentState }
    this.logStep(id, 'step3', true, result)
    this.broadcast('step3')
    return { finalized: true, state: this.currentState }
  }

  private async runStepsInternal(id: string, steps: string[], atomic: boolean, timeoutMs: number) {
    const exec = async () => {
      const snapshotState = this.currentState
      const results: Array<{ step: string; ok: boolean; result?: any }> = []
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
      } catch (e: any) {
        if (atomic) this.currentState = snapshotState
        return { ok: false, error: String(e?.message ?? e), results }
      }
    }
    return Promise.race([
      exec(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('执行超时')), timeoutMs)),
    ])
  }

  async handleTrigger(input: { headers: Record<string, string | string[] | undefined>; body: any }) {
    const apiKeyHeader =
      (input.headers['x-api-key'] as string) ||
      (input.headers['X-API-Key'] as unknown as string)
    if (apiKeyHeader !== this.API_KEY) {
      return { statusCode: 401, status: 'error', error: '未授权' }
    }
    const idKey =
      (input.headers['x-idempotency-key'] as string) ||
      (input.headers['X-Idempotency-Key'] as unknown as string) ||
      crypto.randomUUID()

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
    if (!steps.length || !steps.every((s: any) => ['step1', 'step2', 'step3'].includes(s))) {
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

  async handleNodeRequest(req: IncomingMessage, res: ServerResponse) {
    const sendJson = (code: number, data: any) => {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-API-Key,X-Idempotency-Key',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
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
    if (url.pathname === '/api/steps/trigger' && req.method === 'POST') {
      const body = await new Promise<any>((resolve, reject) => {
        const chunks: Buffer[] = []
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
      const resp = await this.handleTrigger({ headers: req.headers as any, body })
      sendJson(resp.statusCode || 200, resp)
      return
    }
    res.statusCode = 404
    res.end(JSON.stringify({ statusCode: 404, status: 'error', error: '未找到接口' }))
  }
}
