import type {
  OracleRoutingRequest,
  CreateMarketRequest,
  BetRequest,
  Poll,
  ConnectedWallet
} from '../types'

// ============ Common Validation Patterns ============

export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
  POSITIVE_NUMBER: /^\d*\.?\d+$/,
  INTEGER: /^\d+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
}

// ============ Validation Result Types ============

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export interface FieldValidation {
  field: string
  isValid: boolean
  error?: string
  warning?: string
}

// ============ Basic Validators ============

export const isRequired = (value: any, fieldName: string = 'Field'): FieldValidation => {
  const isValid = value !== null && value !== undefined && value !== ''
  return {
    field: fieldName,
    isValid,
    error: !isValid ? `${fieldName} is required` : undefined
  }
}

export const isString = (value: any, fieldName: string = 'Field'): FieldValidation => {
  const isValid = typeof value === 'string'
  return {
    field: fieldName,
    isValid,
    error: !isValid ? `${fieldName} must be a string` : undefined
  }
}

export const isNumber = (value: any, fieldName: string = 'Field'): FieldValidation => {
  const isValid = typeof value === 'number' && !isNaN(value) && isFinite(value)
  return {
    field: fieldName,
    isValid,
    error: !isValid ? `${fieldName} must be a valid number` : undefined
  }
}

export const isPositiveNumber = (value: any, fieldName: string = 'Field'): FieldValidation => {
  const numberCheck = isNumber(value, fieldName)
  if (!numberCheck.isValid) return numberCheck
  
  const isValid = value > 0
  return {
    field: fieldName,
    isValid,
    error: !isValid ? `${fieldName} must be greater than 0` : undefined
  }
}

export const isInRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string = 'Field'
): FieldValidation => {
  const isValid = value >= min && value <= max
  return {
    field: fieldName,
    isValid,
    error: !isValid ? `${fieldName} must be between ${min} and ${max}` : undefined
  }
}

export const hasMinLength = (
  value: string,
  minLength: number,
  fieldName: string = 'Field'
): FieldValidation => {
  const isValid = value && value.length >= minLength
  return {
    field: fieldName,
    isValid,
    error: !isValid ? `${fieldName} must be at least ${minLength} characters` : undefined
  }
}

export const hasMaxLength = (
  value: string,
  maxLength: number,
  fieldName: string = 'Field'
): FieldValidation => {
  const isValid = !value || value.length <= maxLength
  return {
    field: fieldName,
    isValid,
    error: !isValid ? `${fieldName} must be no more than ${maxLength} characters` : undefined
  }
}

export const matchesPattern = (
  value: string,
  pattern: RegExp,
  errorMessage: string,
  fieldName: string = 'Field'
): FieldValidation => {
  const isValid = pattern.test(value)
  return {
    field: fieldName,
    isValid,
    error: !isValid ? errorMessage : undefined
  }
}

// ============ Ethereum/Web3 Validators ============

export const isValidEthereumAddress = (
  address: string,
  fieldName: string = 'Address'
): FieldValidation => {
  return matchesPattern(
    address,
    VALIDATION_PATTERNS.ETHEREUM_ADDRESS,
    `${fieldName} must be a valid Ethereum address`,
    fieldName
  )
}

export const isValidTransactionHash = (
  hash: string,
  fieldName: string = 'Transaction Hash'
): FieldValidation => {
  return matchesPattern(
    hash,
    VALIDATION_PATTERNS.TRANSACTION_HASH,
    `${fieldName} must be a valid transaction hash`,
    fieldName
  )
}

export const isValidAmount = (
  amount: string | number,
  fieldName: string = 'Amount'
): FieldValidation => {
  const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numericValue)) {
    return {
      field: fieldName,
      isValid: false,
      error: `${fieldName} must be a valid number`
    }
  }
  
  return isPositiveNumber(numericValue, fieldName)
}

// ============ Oracle Request Validation ============

export const validateOracleRoutingRequest = (request: OracleRoutingRequest): ValidationResult => {
  const validations: FieldValidation[] = [
    isRequired(request.question, 'Question'),
    hasMinLength(request.question || '', 10, 'Question'),
    hasMaxLength(request.question || '', 500, 'Question')
  ]
  
  if (request.max_latency_ms !== undefined) {
    validations.push(isPositiveNumber(request.max_latency_ms, 'Max Latency'))
  }
  
  if (request.max_cost_usd !== undefined) {
    validations.push(isPositiveNumber(Number(request.max_cost_usd), 'Max Cost'))
  }
  
  if (request.required_chains && request.required_chains.length > 0) {
    const chainValidations = request.required_chains.map((chain, index) =>
      isRequired(chain, `Chain ${index + 1}`)
    )
    validations.push(...chainValidations)
  }
  
  const errors = validations.filter(v => !v.isValid).map(v => v.error!).filter(Boolean)
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ============ Market Creation Validation ============

export const validateCreateMarketRequest = (request: CreateMarketRequest): ValidationResult => {
  const validations: FieldValidation[] = [
    isRequired(request.question, 'Question'),
    hasMinLength(request.question || '', 10, 'Question'),
    hasMaxLength(request.question || '', 200, 'Question'),
    isRequired(request.options, 'Options'),
    isRequired(request.category, 'Category')
  ]
  
  // Validate options array
  if (request.options) {
    if (request.options.length < 2) {
      validations.push({
        field: 'Options',
        isValid: false,
        error: 'At least 2 options are required'
      })
    } else if (request.options.length > 10) {
      validations.push({
        field: 'Options',
        isValid: false,
        error: 'Maximum 10 options allowed'
      })
    } else {
      // Validate each option
      request.options.forEach((option, index) => {
        validations.push(
          hasMinLength(option, 1, `Option ${index + 1}`),
          hasMaxLength(option, 100, `Option ${index + 1}`)
        )
      })
      
      // Check for duplicate options
      const uniqueOptions = new Set(request.options)
      if (uniqueOptions.size !== request.options.length) {
        validations.push({
          field: 'Options',
          isValid: false,
          error: 'Options must be unique'
        })
      }
    }
  }
  
  // Validate description if provided
  if (request.description) {
    validations.push(
      hasMaxLength(request.description, 1000, 'Description')
    )
  }
  
  // Validate expiration date if provided
  if (request.expires_at) {
    const expirationDate = new Date(request.expires_at)
    const now = new Date()
    
    if (isNaN(expirationDate.getTime())) {
      validations.push({
        field: 'Expiration Date',
        isValid: false,
        error: 'Invalid expiration date format'
      })
    } else if (expirationDate <= now) {
      validations.push({
        field: 'Expiration Date',
        isValid: false,
        error: 'Expiration date must be in the future'
      })
    } else if (expirationDate > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) {
      validations.push({
        field: 'Expiration Date',
        isValid: false,
        warning: 'Expiration date is more than 1 year in the future'
      })
    }
  }
  
  // Validate initial liquidity if provided
  if (request.initial_liquidity !== undefined) {
    validations.push(isPositiveNumber(request.initial_liquidity, 'Initial Liquidity'))
  }
  
  const errors = validations.filter(v => !v.isValid).map(v => v.error!).filter(Boolean)
  const warnings = validations.map(v => v.warning).filter(Boolean)
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// ============ Bet Request Validation ============

export const validateBetRequest = (
  request: BetRequest,
  poll: Poll,
  wallet: ConnectedWallet
): ValidationResult => {
  const validations: FieldValidation[] = [
    isRequired(request.poll_id, 'Poll ID'),
    isRequired(request.option_id, 'Option ID'),
    isRequired(request.amount, 'Bet Amount'),
    isPositiveNumber(request.amount, 'Bet Amount')
  ]
  
  // Validate poll exists and is active
  if (!poll) {
    validations.push({
      field: 'Poll',
      isValid: false,
      error: 'Poll not found'
    })
  } else {
    if (poll.resolved) {
      validations.push({
        field: 'Poll',
        isValid: false,
        error: 'Cannot bet on resolved poll'
      })
    }
    
    if (poll.expires_at && new Date(poll.expires_at) <= new Date()) {
      validations.push({
        field: 'Poll',
        isValid: false,
        error: 'Cannot bet on expired poll'
      })
    }
    
    // Validate option exists
    if (!poll.options.find(option => option.id === request.option_id)) {
      validations.push({
        field: 'Option',
        isValid: false,
        error: 'Invalid option selected'
      })
    }
  }
  
  // Validate wallet balance (simplified check)
  const walletBalance = parseFloat(wallet.balance)
  if (walletBalance < request.amount) {
    validations.push({
      field: 'Amount',
      isValid: false,
      error: 'Insufficient wallet balance'
    })
  }
  
  // Validate slippage tolerance if provided
  if (request.slippage_tolerance !== undefined) {
    validations.push(
      isInRange(request.slippage_tolerance, 0, 1, 'Slippage Tolerance')
    )
  }
  
  // Warning for large bets
  if (request.amount > walletBalance * 0.1) {
    validations.push({
      field: 'Amount',
      isValid: true,
      warning: 'Betting more than 10% of wallet balance is risky'
    })
  }
  
  const errors = validations.filter(v => !v.isValid).map(v => v.error!).filter(Boolean)
  const warnings = validations.map(v => v.warning).filter(Boolean)
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// ============ Generic Form Validation ============

export const validateForm = <T extends Record<string, any>>(
  data: T,
  rules: Record<keyof T, Array<(value: any, fieldName: string) => FieldValidation>>
): ValidationResult => {
  const validations: FieldValidation[] = []
  
  Object.entries(rules).forEach(([fieldName, validators]) => {
    const fieldValue = data[fieldName as keyof T]
    
    validators.forEach(validator => {
      const result = validator(fieldValue, fieldName)
      validations.push(result)
    })
  })
  
  const errors = validations.filter(v => !v.isValid).map(v => v.error!).filter(Boolean)
  const warnings = validations.map(v => v.warning).filter(Boolean)
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// ============ Sanitization Helpers ============

export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potential XSS characters
    .substring(0, 1000) // Limit length
}

export const sanitizeAmount = (input: string | number): number => {
  const num = typeof input === 'string' ? parseFloat(input) : input
  
  if (isNaN(num) || num < 0) return 0
  if (num > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER
  
  // Round to 6 decimal places to avoid floating point issues
  return Math.round(num * 1e6) / 1e6
}

export const sanitizeAddress = (address: string): string => {
  return address.toLowerCase().trim()
}

// ============ Business Logic Validation ============

export const validatePollConfiguration = (poll: Partial<Poll>): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Oracle-backed poll validation
  if (poll.oracle_backed) {
    if (!poll.auto_resolve) {
      warnings.push('Oracle-backed polls should typically use auto-resolve')
    }
    
    if (poll.expires_at) {
      const expiresAt = new Date(poll.expires_at)
      const maxOracleTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      
      if (expiresAt > maxOracleTime) {
        warnings.push('Very long-term oracle-backed polls may have reliability issues')
      }
    }
  }
  
  // Option balance validation
  if (poll.options && poll.options.length > 0) {
    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0)
    
    if (totalVotes > 0) {
      const probabilities = poll.options.map(option => option.votes / totalVotes)
      const maxProbability = Math.max(...probabilities)
      
      if (maxProbability > 0.95) {
        warnings.push('Market appears heavily skewed toward one option')
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}