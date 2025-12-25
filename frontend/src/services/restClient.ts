import { API_CONFIG } from '../constants'

export type StepName = 'step1' | 'step2' | 'step3'

export interface TriggerOptions {
  atomic?: boolean
  timeoutMs?: number
  idempotencyKey?: string
}

const headers = (key?: string, idem?: string) => {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': key || API_CONFIG.API_KEY,
  }
  if (idem) h['X-Idempotency-Key'] = idem
  return h
}

export async function triggerStep(step: StepName, opts: TriggerOptions = {}) {
  const idKey = opts.idempotencyKey || (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2)
  const res = await fetch(`${API_CONFIG.BASE_URL}/api/steps/trigger`, {
    method: 'POST',
    headers: headers(API_CONFIG.API_KEY, idKey),
    body: JSON.stringify({
      step,
      atomic: Boolean(opts.atomic),
      timeoutMs: typeof opts.timeoutMs === 'number' ? opts.timeoutMs : undefined,
    }),
  })
  const json = await res.json()
  return { status: res.status, data: json }
}

export async function triggerSteps(steps: StepName[], opts: TriggerOptions = {}) {
  const idKey = opts.idempotencyKey || (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2)
  const res = await fetch(`${API_CONFIG.BASE_URL}/api/steps/trigger`, {
    method: 'POST',
    headers: headers(API_CONFIG.API_KEY, idKey),
    body: JSON.stringify({
      steps,
      atomic: Boolean(opts.atomic),
      timeoutMs: typeof opts.timeoutMs === 'number' ? opts.timeoutMs : undefined,
    }),
  })
  const json = await res.json()
  return { status: res.status, data: json }
}

export async function resetState() {
  const res = await fetch(`${API_CONFIG.BASE_URL}/api/steps/reset`, {
    method: 'POST',
    headers: headers(API_CONFIG.API_KEY),
  })
  const json = await res.json()
  return { status: res.status, data: json }
}
