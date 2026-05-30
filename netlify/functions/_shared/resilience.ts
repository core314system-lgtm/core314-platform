/**
 * Resilience utilities: retry with exponential backoff + circuit breaker
 *
 * Usage:
 *   import { withRetry, CircuitBreaker } from "./_shared/resilience.ts"
 *
 *   // Simple retry
 *   const data = await withRetry(() => fetch(url), { maxRetries: 3 })
 *
 *   // Circuit breaker
 *   const breaker = new CircuitBreaker("sam-gov", { failureThreshold: 5 })
 *   const data = await breaker.call(() => fetch(url))
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  retryOn?: (error: unknown) => boolean
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    retryOn = () => true,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (attempt >= maxRetries || !retryOn(err)) {
        throw err
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs,
        maxDelayMs
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

type CircuitState = "closed" | "open" | "half-open"

interface CircuitBreakerOptions {
  failureThreshold?: number
  resetTimeoutMs?: number
  halfOpenMaxCalls?: number
}

// In-memory state per function invocation — in serverless this means per cold start.
// For cross-invocation persistence, an external store (Redis, DB) would be needed.
// This still protects against cascading failures within a single invocation.
const circuitStates: Record<
  string,
  {
    state: CircuitState
    failureCount: number
    lastFailureTime: number
    halfOpenCalls: number
  }
> = {}

export class CircuitBreaker {
  private name: string
  private failureThreshold: number
  private resetTimeoutMs: number
  private halfOpenMaxCalls: number

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name
    this.failureThreshold = options.failureThreshold ?? 5
    this.resetTimeoutMs = options.resetTimeoutMs ?? 60000
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1

    if (!circuitStates[name]) {
      circuitStates[name] = {
        state: "closed",
        failureCount: 0,
        lastFailureTime: 0,
        halfOpenCalls: 0,
      }
    }
  }

  private get circuit() {
    return circuitStates[this.name]
  }

  getState(): CircuitState {
    const c = this.circuit
    if (c.state === "open") {
      if (Date.now() - c.lastFailureTime >= this.resetTimeoutMs) {
        c.state = "half-open"
        c.halfOpenCalls = 0
      }
    }
    return c.state
  }

  async call<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    const state = this.getState()
    const c = this.circuit

    if (state === "open") {
      if (fallback) return fallback()
      throw new Error(
        `Circuit breaker "${this.name}" is open — service unavailable. Will retry in ${Math.ceil((this.resetTimeoutMs - (Date.now() - c.lastFailureTime)) / 1000)}s.`
      )
    }

    if (state === "half-open" && c.halfOpenCalls >= this.halfOpenMaxCalls) {
      if (fallback) return fallback()
      throw new Error(
        `Circuit breaker "${this.name}" is half-open — max probe calls reached.`
      )
    }

    try {
      if (state === "half-open") c.halfOpenCalls++
      const result = await fn()

      // Success — reset to closed
      c.state = "closed"
      c.failureCount = 0
      c.halfOpenCalls = 0

      return result
    } catch (err) {
      c.failureCount++
      c.lastFailureTime = Date.now()

      if (c.failureCount >= this.failureThreshold) {
        c.state = "open"
      }

      throw err
    }
  }
}

/**
 * Wrap a fetch call with retry + response validation.
 * Retries on network errors and 5xx responses; does NOT retry 4xx.
 */
export async function resilientFetch(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return withRetry(
    async () => {
      const res = await fetch(url, init)
      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      return res
    },
    {
      maxRetries: 3,
      baseDelayMs: 500,
      retryOn: (err) => {
        // Retry on network errors and server errors
        if (err instanceof TypeError) return true // network error
        if (err instanceof Error && err.message.startsWith("HTTP 5")) return true
        return false
      },
      ...options,
    }
  )
}
