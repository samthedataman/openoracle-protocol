/**
 * Logging utilities for OpenOracle SDK
 */

import { createLogger, format, transports, Logger } from 'winston'
import { OracleConfig } from '../core/config'

export interface LogContext {
  provider?: string
  requestId?: string
  userId?: string
  operation?: string
  duration?: number
  error?: Error
  metadata?: Record<string, any>
}

export class OracleLogger {
  private readonly logger: Logger
  private readonly config: OracleConfig

  constructor(config: OracleConfig) {
    this.config = config
    this.logger = this.createWinstonLogger()
  }

  private createWinstonLogger(): Logger {
    const logFormat = this.config.logging.format === 'json' 
      ? format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json()
        )
      : format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
            return `${timestamp} [${level.toUpperCase()}] ${message}${metaString}`
          })
        )

    const logTransports: any[] = []

    // Console transport
    if (this.config.logging.destination === 'console' || this.config.logging.destination === 'both') {
      logTransports.push(new transports.Console({
        level: this.config.logging.level,
        format: logFormat
      }))
    }

    // File transport
    if (this.config.logging.destination === 'file' || this.config.logging.destination === 'both') {
      logTransports.push(new transports.File({
        filename: this.config.logging.filePath || './logs/openoracle.log',
        level: this.config.logging.level,
        format: logFormat,
        maxsize: this.parseSize(this.config.logging.maxFileSize || '10m'),
        maxFiles: this.config.logging.maxFiles || 5
      }))
    }

    return createLogger({
      level: this.config.logging.level,
      format: logFormat,
      transports: logTransports,
      exitOnError: false
    })
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+)([kmg]?)$/i)
    if (!match) return 10 * 1024 * 1024 // Default 10MB

    const size = parseInt(match[1])
    const unit = match[2]?.toLowerCase() || ''

    switch (unit) {
      case 'k': return size * 1024
      case 'm': return size * 1024 * 1024
      case 'g': return size * 1024 * 1024 * 1024
      default: return size
    }
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.formatContext(context))
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, this.formatContext(context))
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.formatContext(context))
  }

  error(message: string, context?: LogContext): void {
    this.logger.error(message, this.formatContext(context))
  }

  private formatContext(context?: LogContext): Record<string, any> {
    if (!context) return {}

    const formatted: Record<string, any> = {}

    if (context.provider) formatted.provider = context.provider
    if (context.requestId) formatted.requestId = context.requestId
    if (context.userId) formatted.userId = context.userId
    if (context.operation) formatted.operation = context.operation
    if (context.duration !== undefined) formatted.duration = `${context.duration}ms`
    if (context.error) {
      formatted.error = {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack
      }
    }
    if (context.metadata) formatted.metadata = context.metadata

    return formatted
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 5000 ? 'warn' : duration > 2000 ? 'info' : 'debug'
    const message = `Performance: ${operation} completed in ${duration}ms`
    
    this.logger.log(level, message, this.formatContext({
      ...context,
      operation,
      duration
    }))
  }

  // Provider-specific logging
  logProviderQuery(
    provider: string,
    query: string,
    success: boolean,
    duration: number,
    error?: Error
  ): void {
    const message = `Provider query: ${provider} - ${success ? 'SUCCESS' : 'FAILED'}`
    const level = success ? 'info' : 'error'

    this.logger.log(level, message, this.formatContext({
      provider,
      operation: 'query',
      duration,
      error,
      metadata: { query, success }
    }))
  }

  // API request logging
  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestId?: string
  ): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info'
    const message = `API Request: ${method} ${url} - ${statusCode}`

    this.logger.log(level, message, this.formatContext({
      requestId,
      operation: 'api_request',
      duration,
      metadata: { method, url, statusCode }
    }))
  }

  // User activity logging
  logUserActivity(
    userId: string,
    action: string,
    details?: Record<string, any>
  ): void {
    this.logger.info(`User activity: ${action}`, this.formatContext({
      userId,
      operation: action,
      metadata: details
    }))
  }

  // Security event logging
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): void {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info'
    this.logger.log(level, `Security event: ${event}`, this.formatContext({
      operation: 'security_event',
      metadata: { event, severity, ...details }
    }))
  }

  // Business logic logging
  logBusinessEvent(
    event: string,
    value?: number,
    context?: LogContext
  ): void {
    this.logger.info(`Business event: ${event}`, this.formatContext({
      ...context,
      operation: 'business_event',
      metadata: { event, value, ...context?.metadata }
    }))
  }

  // Create child logger with default context
  child(defaultContext: LogContext): OracleLogger {
    const childLogger = new OracleLogger(this.config)
    
    // Override logging methods to include default context
    const originalMethods = {
      debug: childLogger.debug.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      error: childLogger.error.bind(childLogger)
    }

    childLogger.debug = (message: string, context?: LogContext) => {
      originalMethods.debug(message, { ...defaultContext, ...context })
    }

    childLogger.info = (message: string, context?: LogContext) => {
      originalMethods.info(message, { ...defaultContext, ...context })
    }

    childLogger.warn = (message: string, context?: LogContext) => {
      originalMethods.warn(message, { ...defaultContext, ...context })
    }

    childLogger.error = (message: string, context?: LogContext) => {
      originalMethods.error(message, { ...defaultContext, ...context })
    }

    return childLogger
  }

  // Flush logs (useful for graceful shutdown)
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve)
      this.logger.end()
    })
  }
}

// Global logger instance
let globalLogger: OracleLogger | null = null

/**
 * Get the global logger instance
 */
export function getLogger(config?: OracleConfig): OracleLogger {
  if (!globalLogger && config) {
    globalLogger = new OracleLogger(config)
  }
  
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call getLogger with config first.')
  }
  
  return globalLogger
}

/**
 * Set the global logger instance
 */
export function setLogger(logger: OracleLogger): void {
  globalLogger = logger
}

/**
 * Create a performance timer
 */
export function createTimer(operation: string, logger?: OracleLogger): () => void {
  const startTime = Date.now()
  const log = logger || globalLogger
  
  return () => {
    const duration = Date.now() - startTime
    log?.logPerformance(operation, duration)
  }
}

/**
 * Decorator for automatic performance logging
 */
export function logPerformance(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const opName = operation || `${target.constructor.name}.${propertyName}`

    descriptor.value = async function (...args: any[]) {
      const timer = createTimer(opName)
      try {
        const result = await method.apply(this, args)
        timer()
        return result
      } catch (error) {
        timer()
        throw error
      }
    }

    return descriptor
  }
}

/**
 * Structured logging helpers
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
} as const

export type LogLevelType = typeof LogLevel[keyof typeof LogLevel]