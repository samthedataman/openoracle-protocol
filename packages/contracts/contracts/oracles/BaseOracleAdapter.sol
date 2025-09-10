// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IOracle.sol";

/**
 * @title BaseOracleAdapter
 * @dev Abstract base contract for all oracle adapters
 * @notice Provides common functionality for oracle implementations
 */
abstract contract BaseOracleAdapter is IOracle, Ownable, ReentrancyGuard {
    // ============ Constants ============
    uint256 public constant MAX_DATA_AGE = 3600; // 1 hour
    uint256 public constant MIN_CONFIDENCE = 5000; // 50% scaled by 1e4
    uint256 public constant CONFIDENCE_SCALE = 1e4;
    
    // ============ Data Types ============
    bytes32 public constant PRICE_DATA = keccak256("PRICE");
    bytes32 public constant SPORTS_DATA = keccak256("SPORTS");
    bytes32 public constant WEATHER_DATA = keccak256("WEATHER");
    bytes32 public constant ELECTION_DATA = keccak256("ELECTION");
    bytes32 public constant CUSTOM_DATA = keccak256("CUSTOM");
    
    // ============ State Variables ============
    mapping(bytes32 => bool) public supportedDataTypes;
    mapping(bytes32 => uint256) public dataTypeCosts;
    mapping(bytes32 => OracleData) internal cachedData;
    
    uint256 public defaultCost = 0.001 ether;
    bool public isActive = true;
    
    // ============ Events ============
    event DataRequested(bytes32 indexed dataId, address indexed requester);
    event DataUpdated(bytes32 indexed dataId, uint256 value, uint256 timestamp);
    event OracleConfigured(bytes32 indexed dataType, bool supported, uint256 cost);
    event OracleStatusChanged(bool isActive);
    
    // ============ Modifiers ============
    modifier onlyActiveOracle() {
        require(isActive, "Oracle is inactive");
        _;
    }
    
    modifier validDataType(bytes32 dataType) {
        require(supportedDataTypes[dataType], "Unsupported data type");
        _;
    }
    
    modifier validData(OracleData memory data) {
        require(data.timestamp > 0, "Invalid timestamp");
        require(block.timestamp - data.timestamp <= MAX_DATA_AGE, "Data too old");
        require(data.confidence >= MIN_CONFIDENCE, "Confidence too low");
        _;
    }
    
    // ============ Constructor ============
    constructor() {
        // Set default supported data types
        _setSupportedDataType(PRICE_DATA, true, 0.001 ether);
        _setSupportedDataType(CUSTOM_DATA, true, 0.005 ether);
    }
    
    // ============ Abstract Functions ============
    
    /**
     * @dev Must be implemented by each oracle adapter
     */
    function getProvider() external pure virtual override returns (string memory);
    
    /**
     * @dev Must be implemented for price data retrieval
     */
    function _getPriceData(string calldata pair) internal view virtual returns (PriceData memory);
    
    /**
     * @dev Must be implemented for custom data retrieval
     */
    function _getCustomData(bytes32 dataId, bytes calldata params) 
        internal 
        view 
        virtual 
        returns (OracleData memory);
    
    /**
     * @dev Must be implemented for prediction resolution
     */
    function _resolvePrediction(bytes32 questionId, bytes calldata params)
        internal
        virtual
        returns (ResolutionData memory);
    
    // ============ Public Functions ============
    
    /**
     * @dev Checks if oracle supports given data type
     */
    function supportsDataType(bytes32 dataType) external view override returns (bool) {
        return supportedDataTypes[dataType];
    }
    
    /**
     * @dev Gets latest cached data or fetches new data
     */
    function getLatestData(bytes32 dataId) 
        external 
        view 
        override 
        onlyActiveOracle 
        returns (OracleData memory) 
    {
        OracleData memory data = cachedData[dataId];
        
        // Return cached data if recent and valid
        if (data.timestamp > 0 && 
            block.timestamp - data.timestamp <= MAX_DATA_AGE &&
            data.confidence >= MIN_CONFIDENCE) {
            return data;
        }
        
        // If no valid cached data, try custom data fetch
        // This would typically trigger an external call in actual implementation
        revert("No valid data available");
    }
    
    /**
     * @dev Gets price data for asset pair
     */
    function getPrice(string calldata pair) 
        external 
        view 
        override 
        onlyActiveOracle
        validDataType(PRICE_DATA)
        returns (PriceData memory) 
    {
        return _getPriceData(pair);
    }
    
    /**
     * @dev Resolves prediction using oracle data
     */
    function resolvePrediction(bytes32 questionId, bytes calldata params)
        external
        override
        nonReentrant
        onlyActiveOracle
        returns (ResolutionData memory)
    {
        emit DataRequested(questionId, msg.sender);
        return _resolvePrediction(questionId, params);
    }
    
    /**
     * @dev Estimates cost for oracle query
     */
    function estimateCost(bytes32 dataType, bytes calldata params) 
        external 
        view 
        override 
        validDataType(dataType)
        returns (uint256) 
    {
        uint256 baseCost = dataTypeCosts[dataType];
        
        // Add complexity-based cost adjustments
        if (params.length > 100) {
            baseCost = (baseCost * 150) / 100; // 50% increase for complex queries
        }
        
        return baseCost;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Configure supported data types and costs
     */
    function setSupportedDataType(
        bytes32 dataType,
        bool supported,
        uint256 cost
    ) external onlyOwner {
        _setSupportedDataType(dataType, supported, cost);
    }
    
    /**
     * @dev Set oracle active status
     */
    function setActive(bool _isActive) external onlyOwner {
        isActive = _isActive;
        emit OracleStatusChanged(_isActive);
    }
    
    /**
     * @dev Update default cost
     */
    function setDefaultCost(uint256 _defaultCost) external onlyOwner {
        defaultCost = _defaultCost;
    }
    
    /**
     * @dev Emergency data update (for authorized oracles)
     */
    function updateData(
        bytes32 dataId,
        uint256 value,
        uint256 confidence,
        string calldata source
    ) external onlyOwner {
        require(confidence >= MIN_CONFIDENCE, "Confidence too low");
        
        cachedData[dataId] = OracleData({
            value: value,
            timestamp: block.timestamp,
            confidence: confidence,
            dataId: dataId,
            source: source
        });
        
        emit DataUpdated(dataId, value, block.timestamp);
    }
    
    // ============ Internal Functions ============
    
    function _setSupportedDataType(bytes32 dataType, bool supported, uint256 cost) internal {
        supportedDataTypes[dataType] = supported;
        dataTypeCosts[dataType] = cost;
        emit OracleConfigured(dataType, supported, cost);
    }
    
    /**
     * @dev Validates and normalizes oracle data
     */
    function _validateAndNormalize(OracleData memory data) 
        internal 
        pure 
        validData(data) 
        returns (OracleData memory) 
    {
        // Ensure confidence is within bounds
        if (data.confidence > CONFIDENCE_SCALE) {
            data.confidence = CONFIDENCE_SCALE;
        }
        
        return data;
    }
    
    /**
     * @dev Calculates confidence based on data freshness and source reliability
     */
    function _calculateConfidence(uint256 dataAge, uint256 baseConfidence) 
        internal 
        pure 
        returns (uint256) 
    {
        if (dataAge > MAX_DATA_AGE) return 0;
        
        // Reduce confidence as data ages
        uint256 agePenalty = (dataAge * 1000) / MAX_DATA_AGE; // 0-1000 based on age
        uint256 adjustedConfidence = baseConfidence > agePenalty ? 
            baseConfidence - agePenalty : 0;
            
        return adjustedConfidence > MIN_CONFIDENCE ? adjustedConfidence : 0;
    }
}