/**
 * Async utility functions for OpenOracle SDK
 */

import { TimeoutError } from '../core/exceptions'

/**
 * Execute multiple async operations with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(
        errorMessage || `Operation timed out after ${timeoutMs}ms`,
        timeoutMs
      ))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

/**
 * Execute async operations with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    baseDelay?: number
    maxDelay?: number
    backoffFactor?: number
    shouldRetry?: (error: Error, attempt: number) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = () => true
  } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Don't retry on the last attempt
      if (attempt === maxAttempts) {
        break
      }

      // Check if we should retry this error
      if (!shouldRetry(lastError, attempt)) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      )

      await sleep(delay)
    }
  }

  throw lastError!
}

/**
 * Execute multiple promises concurrently with timeout
 */
export async function gatherWithTimeout<T>(
  promises: Promise<T>[],
  timeoutMs: number
): Promise<T[]> {
  const wrappedPromises = promises.map(p => withTimeout(p, timeoutMs))
  return Promise.all(wrappedPromises)
}

/**
 * Execute promises with limited concurrency
 */
export async function mapConcurrent<T, U>(
  items: T[],
  mapper: (item: T, index: number) => Promise<U>,
  concurrency: number = 3
): Promise<U[]> {
  const results: U[] = new Array(items.length)
  const executing: Promise<void>[] = []

  for (let i = 0; i < items.length; i++) {
    const promise = mapper(items[i], i).then(result => {
      results[i] = result
    })

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      // Remove completed promises
      const stillExecuting = executing.filter(p => 
        Promise.race([p, Promise.resolve('done')]).then(v => v !== 'done')
      )
      executing.length = 0
      executing.push(...stillExecuting)
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * Execute promises in batches with delay between batches
 */
export async function batchExecute<T, U>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<U[]>,
  delayBetweenBatches: number = 0
): Promise<U[]> {
  const results: U[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)

    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length && delayBetweenBatches > 0) {
      await sleep(delayBetweenBatches)
    }
  }

  return results
}

/**
 * Promise-based sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Debounce async function calls
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  waitMs: number
): T {
  let timeout: NodeJS.Timeout | null = null
  let lastPromise: Promise<any> | null = null

  return ((...args: any[]) => {
    return new Promise((resolve, reject) => {
      if (timeout) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(async () => {
        try {
          const result = await func(...args)
          lastPromise = Promise.resolve(result)
          resolve(result)
        } catch (error) {
          lastPromise = Promise.reject(error)
          reject(error)
        }
      }, waitMs)
    })
  }) as T
}

/**
 * Throttle async function calls
 */
export function throttle<T extends (...args: any[]) => Promise<any>>(
  func: T,
  limitMs: number
): T {
  let lastExecuted = 0
  let lastPromise: Promise<any> | null = null

  return ((...args: any[]) => {
    const now = Date.now()

    if (now - lastExecuted >= limitMs) {
      lastExecuted = now
      lastPromise = func(...args)
      return lastPromise
    }

    // Return the last promise if still within throttle limit
    return lastPromise || Promise.resolve(undefined)
  }) as T
}

/**
 * Circuit breaker pattern for async operations
 */
export class CircuitBreaker<T extends (...args: any[]) => Promise<any>> {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private func: T,
    private options: {
      failureThreshold?: number
      recoveryTimeout?: number
      monitorTimeout?: number
    } = {}
  ) {
    this.options = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitorTimeout: 30000,   // 30 seconds
      ...options
    }
  }

  async execute(...args: Parameters<T>): Promise<ReturnType<T>> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.recoveryTimeout!) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await this.func(...args)
      
      if (this.state === 'half-open') {
        this.reset()
      }
      
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.options.failureThreshold!) {
      this.state = 'open'
    }
  }

  private reset(): void {
    this.failures = 0
    this.state = 'closed'
    this.lastFailureTime = 0
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    }
  }
}

/**
 * Rate limiter for async operations
 */
export class RateLimiter {
  private tokens: number
  private lastRefill: number

  constructor(
    private maxTokens: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = maxTokens
    this.lastRefill = Date.now()
  }

  async acquire(tokensNeeded: number = 1): Promise<void> {
    this.refillTokens()

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded
      return
    }

    // Calculate wait time
    const tokensShortfall = tokensNeeded - this.tokens
    const waitTime = (tokensShortfall / this.refillRate) * 1000

    await sleep(waitTime)
    return this.acquire(tokensNeeded)
  }

  private refillTokens(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000
    const tokensToAdd = timePassed * this.refillRate

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  getTokens(): number {
    this.refillTokens()
    return this.tokens
  }
}

/**
 * Promise pool for managing concurrent operations
 */
export class PromisePool {
  private running = 0
  private queue: Array<() => Promise<any>> = []

  constructor(private concurrency: number) {}

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.process()
    })
  }

  private async process(): Promise<void> {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return
    }

    this.running++
    const task = this.queue.shift()!

    try {
      await task()
    } catch (error) {
      // Error is handled in the task itself
    } finally {
      this.running--
      this.process() // Process next task
    }
  }

  getStats(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length
    }
  }
}

/**
 * Async event emitter
 */
export class AsyncEventEmitter {
  private listeners: Map<string, Array<(...args: any[]) => Promise<any>>> = new Map()

  on(event: string, listener: (...args: any[]) => Promise<any>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  off(event: string, listener: (...args: any[]) => Promise<any>): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  async emit(event: string, ...args: any[]): Promise<void> {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      await Promise.all(eventListeners.map(listener => listener(...args)))
    }
  }

  once(event: string, listener: (...args: any[]) => Promise<any>): void {
    const onceListener = async (...args: any[]) => {
      await listener(...args)
      this.off(event, onceListener)
    }
    this.on(event, onceListener)
  }
}

/**
 * Utility to convert callback-based functions to promises
 */
export function promisify<T>(
  func: (callback: (error: Error | null, result?: T) => void) => void
): () => Promise<T> {
  return () => {
    return new Promise((resolve, reject) => {
      func((error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve(result as T)
        }
      })
    })
  }
}

/**
 * Create a cancelable promise
 */
export function createCancelablePromise<T>(
  executor: (
    resolve: (value: T) => void,
    reject: (error: Error) => void,
    isCanceled: () => boolean
  ) => void
): { promise: Promise<T>; cancel: () => void } {
  let canceled = false

  const promise = new Promise<T>((resolve, reject) => {
    executor(
      resolve,
      reject,
      () => canceled
    )
  })

  return {
    promise,
    cancel: () => {
      canceled = true
    }
  }
}