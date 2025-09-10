/**
 * Custom exception classes for OpenOracle SDK
 */

export class OracleError extends Error {
  public readonly code: string
  public readonly severity: 'info' | 'warning' | 'error' | 'critical'
  public readonly context: Record<string, any> | undefined

  constructor(
    message: string,
    code: string = 'ORACLE_ERROR',
    severity: 'info' | 'warning' | 'error' | 'critical' = 'error',
    context?: Record<string, any>
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.severity = severity
    this.context = context
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      stack: this.stack
    }
  }
}

export class RoutingError extends OracleError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'ROUTING_ERROR', 'error', context)
  }
}

export class ValidationError extends OracleError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 'error', context)
  }
}

export class ConfigurationError extends OracleError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', 'error', context)
  }
}

export class ProviderError extends OracleError {
  public readonly provider: string

  constructor(message: string, provider: string, context?: Record<string, any>) {
    super(message, 'PROVIDER_ERROR', 'error', { ...context, provider })
    this.provider = provider
  }
}

export class NetworkError extends OracleError {
  public readonly statusCode?: number
  public readonly response?: any

  constructor(
    message: string,
    statusCode?: number,
    response?: any,
    context?: Record<string, any>
  ) {
    super(message, 'NETWORK_ERROR', 'error', { ...context, statusCode, response })
    this.statusCode = statusCode
    this.response = response
  }
}

export class AuthenticationError extends OracleError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 'error', context)
  }
}

export class RateLimitError extends OracleError {
  public readonly retryAfter: number | undefined

  constructor(message: string, retryAfter?: number, context?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 'warning', { ...context, retryAfter })
    this.retryAfter = retryAfter
  }
}

export class TimeoutError extends OracleError {
  public readonly timeoutMs: number

  constructor(message: string, timeoutMs: number, context?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', 'error', { ...context, timeoutMs })
    this.timeoutMs = timeoutMs
  }
}

export class DataIntegrityError extends OracleError {
  public readonly expectedValue?: any
  public readonly actualValue?: any

  constructor(
    message: string,
    expectedValue?: any,
    actualValue?: any,
    context?: Record<string, any>
  ) {
    super(message, 'DATA_INTEGRITY_ERROR', 'critical', {
      ...context,
      expectedValue,
      actualValue
    })
    this.expectedValue = expectedValue
    this.actualValue = actualValue
  }
}

export class UnsupportedOperationError extends OracleError {
  public readonly operation: string
  public readonly provider?: string

  constructor(
    operation: string,
    provider?: string,
    context?: Record<string, any>
  ) {
    const message = provider 
      ? `Operation '${operation}' is not supported by provider '${provider}'`
      : `Operation '${operation}' is not supported`
    
    super(message, 'UNSUPPORTED_OPERATION_ERROR', 'error', {
      ...context,
      operation,
      provider
    })
    this.operation = operation
    this.provider = provider
  }
}

export class CacheError extends OracleError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CACHE_ERROR', 'warning', context)
  }
}

export class ConsensusError extends OracleError {
  public readonly providers: string[]
  public readonly values: any[]

  constructor(
    message: string,
    providers: string[],
    values: any[],
    context?: Record<string, any>
  ) {
    super(message, 'CONSENSUS_ERROR', 'error', { ...context, providers, values })
    this.providers = providers
    this.values = values
  }
}

/**
 * Type guard to check if an error is an OracleError
 */
export function isOracleError(error: any): error is OracleError {
  return error instanceof OracleError
}

/**
 * Type guard to check if an error is a specific type of OracleError
 */
export function isSpecificOracleError<T extends OracleError>(
  error: any,
  ErrorClass: new (...args: any[]) => T
): error is T {
  return error instanceof ErrorClass
}

/**
 * Helper function to create error from unknown error type
 */
export function normalizeError(error: unknown): OracleError {
  if (isOracleError(error)) {
    return error
  }
  
  if (error instanceof Error) {
    return new OracleError(error.message, 'UNKNOWN_ERROR', 'error', {
      originalError: error.name,
      stack: error.stack
    })
  }
  
  return new OracleError(
    String(error),
    'UNKNOWN_ERROR',
    'error',
    { originalError: error }
  )
}