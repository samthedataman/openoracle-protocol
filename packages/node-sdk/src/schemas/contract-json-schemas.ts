/**
 * JSON Schema Validation for Oracle Contracts
 * 
 * This module ensures that JSON responses from LLM providers match exactly
 * with the smart contract structures defined in:
 * /Users/samsavage/flow-nft/contracts/contracts/interfaces/IOracle.sol
 * 
 * All interfaces here MUST match the Solidity structs exactly.
 */

// ============ Contract Enums (matching IOracle.sol) ============

export enum OracleProvider {
  CHAINLINK = 'CHAINLINK', // 0
  PYTH = 'PYTH',           // 1  
  UMA = 'UMA',             // 2
  API3 = 'API3',           // 3
  CUSTOM = 'CUSTOM'        // 4
}

export enum MarketStatus {
  ACTIVE = 'ACTIVE',       // 0
  RESOLVED = 'RESOLVED',   // 1
  CANCELLED = 'CANCELLED', // 2
  DISPUTED = 'DISPUTED'    // 3
}

// ============ Core Contract Structures ============

/**
 * Matches IOracle.OracleData struct exactly
 */
export interface OracleData {
  value: bigint        // uint256 value
  timestamp: bigint    // uint256 timestamp
  confidence: number   // uint256 confidence (scaled by 1e4, max 10000)
  dataId: string      // bytes32 dataId (hex string)
  source: string      // string source
}

/**
 * Matches IOracle.PriceData struct exactly
 */
export interface PriceData {
  price: bigint        // uint256 price
  timestamp: bigint    // uint256 timestamp
  decimals: number     // uint8 decimals (0-18)
  confidence: number   // uint256 confidence (scaled by 1e4)
  feedId: string      // bytes32 feedId (hex string)
}

/**
 * Matches IOracle.ResolutionData struct exactly
 */
export interface ResolutionData {
  result: bigint       // uint256 result
  resolved: boolean    // bool resolved
  timestamp: bigint    // uint256 timestamp
  proof: string       // bytes proof (hex string)
  metadata: string    // string metadata
}

// ============ Router Structures ============

/**
 * Matches IOracleRouter.RouteConfig struct exactly
 */
export interface RouteConfig {
  provider: OracleProvider  // OracleProvider provider
  oracleAddress: string    // address oracleAddress
  priority: bigint         // uint256 priority
  maxCost: bigint         // uint256 maxCost
  isActive: boolean       // bool isActive
}

/**
 * Matches IOracleRouter.RouteResult struct exactly
 */
export interface RouteResult {
  success: boolean              // bool success
  selectedProvider: OracleProvider // OracleProvider selectedProvider
  oracleAddress: string        // address oracleAddress
  estimatedCost: bigint       // uint256 estimatedCost
  reason: string              // string reason
}

// ============ Prediction Market Structures ============

/**
 * Matches IPredictionMarket.Market struct exactly
 */
export interface Market {
  marketId: bigint         // uint256 marketId
  question: string         // string question
  creator: string         // address creator
  endTime: bigint         // uint256 endTime
  status: MarketStatus    // MarketStatus status
  totalPool: bigint       // uint256 totalPool
  paymentToken: string    // address paymentToken
  oracleDataType: string  // bytes32 oracleDataType
  assignedOracle: string  // address assignedOracle
  oracleParams: string    // bytes oracleParams
}

/**
 * Matches IPredictionMarket.Position struct exactly
 */
export interface Position {
  amount: bigint      // uint256 amount
  outcome: number     // uint8 outcome (0-255)
  timestamp: bigint   // uint256 timestamp
  multiplier: bigint  // uint256 multiplier
}

// ============ LLM Response Schemas ============

/**
 * JSON schema for LLM responses when selecting oracle providers
 */
export interface OracleRoutingResponse {
  selectedOracle: OracleProvider
  reasoning: string              // min 50 chars
  confidence: number            // 0-1
  estimatedCost?: number        // USD
  estimatedTime?: number        // seconds
  fallbackOptions: OracleProvider[]
}

/**
 * JSON schema for LLM responses when resolving prediction markets
 */
export interface PredictionMarketResolution {
  winningOutcome: number        // 0-255
  resolutionValue?: bigint      // actual value that determined outcome
  confidence: number           // 0-1
  dataSources: string[]       // min 1 item
  reasoning: string           // min 100 chars
  timestamp: bigint
  proofHash?: string
}

/**
 * JSON schema for validating oracle data quality
 */
export interface OracleDataValidation {
  isValid: boolean
  confidenceScore: number      // 0-1
  anomalyDetected: boolean
  dataFreshness: number       // age in seconds
  sourceReliability: number   // 0-1
  issues: string[]
  recommendations: string[]
}

// ============ Validation Functions ============

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function isValidBytes32(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

export function isValidHexBytes(value: string): boolean {
  return /^0x[a-fA-F0-9]*$/.test(value)
}

export function validateOracleData(data: any): data is OracleData {
  return (
    typeof data === 'object' &&
    typeof data.value === 'bigint' &&
    typeof data.timestamp === 'bigint' &&
    typeof data.confidence === 'number' &&
    data.confidence >= 0 && data.confidence <= 10000 &&
    typeof data.dataId === 'string' &&
    isValidBytes32(data.dataId) &&
    typeof data.source === 'string'
  )
}

export function validatePriceData(data: any): data is PriceData {
  return (
    typeof data === 'object' &&
    typeof data.price === 'bigint' &&
    typeof data.timestamp === 'bigint' &&
    typeof data.decimals === 'number' &&
    data.decimals >= 0 && data.decimals <= 18 &&
    typeof data.confidence === 'number' &&
    data.confidence >= 0 && data.confidence <= 10000 &&
    typeof data.feedId === 'string' &&
    isValidBytes32(data.feedId)
  )
}

export function validateRouteResult(data: any): data is RouteResult {
  return (
    typeof data === 'object' &&
    typeof data.success === 'boolean' &&
    Object.values(OracleProvider).includes(data.selectedProvider) &&
    typeof data.oracleAddress === 'string' &&
    (data.oracleAddress === '0x0000000000000000000000000000000000000000' || 
     isValidEthereumAddress(data.oracleAddress)) &&
    typeof data.estimatedCost === 'bigint' &&
    typeof data.reason === 'string'
  )
}

export function validateMarket(data: any): data is Market {
  return (
    typeof data === 'object' &&
    typeof data.marketId === 'bigint' &&
    typeof data.question === 'string' &&
    typeof data.creator === 'string' &&
    isValidEthereumAddress(data.creator) &&
    typeof data.endTime === 'bigint' &&
    Object.values(MarketStatus).includes(data.status) &&
    typeof data.totalPool === 'bigint' &&
    typeof data.paymentToken === 'string' &&
    isValidEthereumAddress(data.paymentToken) &&
    typeof data.oracleDataType === 'string' &&
    isValidBytes32(data.oracleDataType) &&
    typeof data.assignedOracle === 'string' &&
    isValidEthereumAddress(data.assignedOracle) &&
    typeof data.oracleParams === 'string' &&
    isValidHexBytes(data.oracleParams)
  )
}

// ============ JSON Schema Generation for LLMs ============

export interface JSONSchema {
  type: string
  properties: Record<string, any>
  required: string[]
}

export function generateJSONSchemaForLLM<T>(schemaName: string): JSONSchema {
  const schemas: Record<string, JSONSchema> = {
    OracleRoutingResponse: {
      type: 'object',
      properties: {
        selectedOracle: {
          type: 'string',
          enum: Object.values(OracleProvider),
          description: 'The selected oracle provider'
        },
        reasoning: {
          type: 'string',
          minLength: 50,
          description: 'Detailed reasoning for selection'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence in selection (0-1)'
        },
        estimatedCost: {
          type: 'number',
          description: 'Estimated cost in USD'
        },
        estimatedTime: {
          type: 'number',
          description: 'Estimated response time in seconds'
        },
        fallbackOptions: {
          type: 'array',
          items: {
            type: 'string',
            enum: Object.values(OracleProvider)
          },
          description: 'Alternative providers'
        }
      },
      required: ['selectedOracle', 'reasoning', 'confidence', 'fallbackOptions']
    },

    PredictionMarketResolution: {
      type: 'object',
      properties: {
        winningOutcome: {
          type: 'number',
          minimum: 0,
          maximum: 255,
          description: 'Winning outcome index'
        },
        resolutionValue: {
          type: 'string', // bigint as string for JSON
          description: 'Actual value that determined outcome'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence in resolution'
        },
        dataSources: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Data sources used'
        },
        reasoning: {
          type: 'string',
          minLength: 100,
          description: 'Detailed reasoning for resolution'
        },
        timestamp: {
          type: 'string', // bigint as string for JSON
          description: 'Resolution timestamp'
        },
        proofHash: {
          type: 'string',
          description: 'Hash of proof data'
        }
      },
      required: ['winningOutcome', 'confidence', 'dataSources', 'reasoning', 'timestamp']
    },

    OracleDataValidation: {
      type: 'object',
      properties: {
        isValid: {
          type: 'boolean',
          description: 'Whether data passes validation'
        },
        confidenceScore: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Data quality confidence'
        },
        anomalyDetected: {
          type: 'boolean',
          description: 'Whether anomalies were found'
        },
        dataFreshness: {
          type: 'number',
          description: 'Age of data in seconds'
        },
        sourceReliability: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Source reliability score'
        },
        issues: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of issues found'
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recommendations for improvement'
        }
      },
      required: ['isValid', 'confidenceScore', 'anomalyDetected', 'dataFreshness', 'sourceReliability', 'issues', 'recommendations']
    }
  }

  const schema = schemas[schemaName]
  if (!schema) {
    throw new Error(`Schema ${schemaName} not found`)
  }

  return schema
}

export function createLLMPromptWithSchema(
  taskDescription: string,
  schemaName: string,
  examples?: any[]
): string {
  const schema = generateJSONSchemaForLLM(schemaName)
  
  let prompt = `Task: ${taskDescription}

You must respond with valid JSON that exactly matches this schema:

${JSON.stringify(schema, null, 2)}

Requirements:
- All fields marked as required must be present
- Follow the exact field names and types specified
- Ensure enum values match exactly (case-sensitive)
- Addresses must be valid Ethereum addresses (0x + 40 hex chars)
- Bytes32 values must be 0x + 64 hex chars
- Confidence scores must be between 0 and 1
- Use string format for bigint values (e.g., "12345" not 12345)

`

  if (examples) {
    prompt += 'Examples of valid responses:\n\n'
    examples.forEach((example, i) => {
      prompt += `Example ${i + 1}:\n${JSON.stringify(example, null, 2)}\n\n`
    })
  }

  prompt += 'Respond with valid JSON only. Do not include any additional text or explanation.'

  return prompt
}

// ============ Contract Compatibility ============

export function validateContractCompatibility(
  data: any,
  contractStruct: string
): boolean {
  switch (contractStruct) {
    case 'OracleData':
      return validateOracleData(data)
    case 'PriceData':
      return validatePriceData(data)
    case 'RouteResult':
      return validateRouteResult(data)
    case 'Market':
      return validateMarket(data)
    default:
      return false
  }
}

// ============ Examples ============

export const EXAMPLE_ORACLE_DATA: OracleData = {
  value: BigInt('4250000000000000000000'), // $4250.00 with 18 decimals
  timestamp: BigInt('1703097600'),
  confidence: 9500, // 95.00%
  dataId: '0x4254432d5553440000000000000000000000000000000000000000000000000', // BTC-USD
  source: 'chainlink_aggregator'
}

export const EXAMPLE_ROUTE_RESULT: RouteResult = {
  success: true,
  selectedProvider: OracleProvider.CHAINLINK,
  oracleAddress: '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419',
  estimatedCost: BigInt('500000000000000000'), // 0.5 ETH
  reason: 'Best price-reliability ratio'
}

export const EXAMPLE_ORACLE_ROUTING_RESPONSE: OracleRoutingResponse = {
  selectedOracle: OracleProvider.CHAINLINK,
  reasoning: 'Chainlink is optimal for BTC price data due to its robust aggregation of multiple high-quality price feeds with proven reliability and sub-minute updates',
  confidence: 0.92,
  estimatedCost: 0.25,
  estimatedTime: 30,
  fallbackOptions: [OracleProvider.PYTH, OracleProvider.API3]
}

export const EXAMPLE_PREDICTION_RESOLUTION: PredictionMarketResolution = {
  winningOutcome: 0,
  resolutionValue: BigInt('105000'),
  confidence: 0.98,
  dataSources: ['coinbase', 'binance', 'kraken_spot'],
  reasoning: 'Bitcoin price reached $105,000 on December 15, 2024, exceeding the $100k threshold. This was confirmed across multiple major exchanges with consistent pricing.',
  timestamp: BigInt('1734220800'),
  proofHash: '0xa7b4c9d3e2f1a8b5c6d7e8f9a1b2c3d4e5f6a7b8c9d0'
}

// ============ Schema Registry ============

export const CONTRACT_SCHEMAS = {
  // Core Oracle Interfaces
  OracleData: 'OracleData',
  PriceData: 'PriceData', 
  ResolutionData: 'ResolutionData',
  
  // Router Schemas
  RouteConfig: 'RouteConfig',
  RouteResult: 'RouteResult',
  
  // Prediction Market Schemas
  Market: 'Market',
  Position: 'Position',
  
  // LLM Response Schemas
  OracleRoutingResponse: 'OracleRoutingResponse',
  PredictionMarketResolution: 'PredictionMarketResolution',
  OracleDataValidation: 'OracleDataValidation'
} as const

export function listAvailableSchemas(): string[] {
  return Object.keys(CONTRACT_SCHEMAS)
}