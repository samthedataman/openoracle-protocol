// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PythAdapter
 * @dev Pyth Network oracle adapter optimized for Base L2
 * @notice Handles real-time price feeds with high frequency updates
 */
contract PythAdapter is Ownable, ReentrancyGuard {

    // ============ Constants ============
    uint256 public constant STALENESS_THRESHOLD = 300; // 5 minutes (Pyth updates frequently)
    uint256 public constant MIN_CONFIDENCE = 8500; // 85% confidence minimum for Pyth
    uint256 public constant BASE_COST = 0.0001 ether; // Lower cost due to efficient updates
    uint256 public constant CONFIDENCE_MULTIPLIER = 1e6; // Pyth confidence scaling
    
    // Base L2 Pyth contract addresses
    address public constant PYTH_CONTRACT = 0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a;
    
    // ============ Data Types ============
    bytes32 public constant PRICE_DATA = keccak256("PRICE_DATA");
    bytes32 public constant CRYPTO_DATA = keccak256("CRYPTO_DATA");
    bytes32 public constant FX_DATA = keccak256("FX_DATA");
    bytes32 public constant COMMODITIES_DATA = keccak256("COMMODITIES_DATA");

    // ============ State Variables ============
    mapping(string => bytes32) public priceIds; // symbol => Pyth price ID
    mapping(bytes32 => PriceConfig) public priceConfigs;
    mapping(bytes32 => bool) public supportedDataTypes;
    mapping(bytes32 => CachedPrice) public priceCache;
    
    uint256 public totalRequests;
    uint256 public successfulRequests;
    uint256 public averageResponseTime;
    uint256 public cacheHitRate;
    uint256 public lastUpdateTime;

    // ============ Structs ============
    struct PriceConfig {
        bytes32 priceId;
        string symbol;
        uint8 decimals;
        uint256 maxStaleness;
        uint256 minConfidence;
        bool isActive;
    }

    struct CachedPrice {
        uint256 price;
        uint256 confidence;
        uint256 timestamp;
        int32 expo;
        bool valid;
    }

    struct OracleData {
        uint256 value;
        uint256 timestamp;
        uint256 confidence;
        bytes32 dataId;
        string source;
    }

    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint8 decimals;
        uint256 confidence;
        bytes32 feedId;
    }

    struct ResolutionData {
        uint256 result;
        bool resolved;
        uint256 timestamp;
        bytes proof;
        string metadata;
    }

    // Pyth-specific structures
    struct PythPrice {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    struct PythPriceUpdate {
        bytes32 id;
        PythPrice price;
        PythPrice emaPrice;
    }

    // ============ Events ============
    event PriceIdAdded(string indexed symbol, bytes32 indexed priceId);
    event PriceUpdated(bytes32 indexed priceId, uint256 price, uint256 confidence, uint256 timestamp);
    event CacheHit(bytes32 indexed priceId, uint256 timestamp);
    event DataRequested(bytes32 indexed dataId, bytes32 dataType, uint256 timestamp);

    // ============ Modifiers ============
    modifier validDataType(bytes32 dataType) {
        require(supportedDataTypes[dataType], "Unsupported data type");
        _;
    }

    modifier validPriceId(bytes32 priceId) {
        require(priceConfigs[priceId].isActive, "Price ID not active");
        _;
    }

    // ============ Constructor ============
    constructor() {
        // Initialize supported data types
        supportedDataTypes[PRICE_DATA] = true;
        supportedDataTypes[CRYPTO_DATA] = true;
        supportedDataTypes[FX_DATA] = true;
        supportedDataTypes[COMMODITIES_DATA] = true;

        // Add major cryptocurrency price feeds
        _addPriceId("ETH/USD", 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace, 8);
        _addPriceId("BTC/USD", 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43, 8);
        _addPriceId("USDC/USD", 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a, 8);
        _addPriceId("USDT/USD", 0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b, 8);
        _addPriceId("SOL/USD", 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d, 8);
    }

    // ============ Core Interface Implementation ============

    /**
     * @dev Returns the oracle provider identifier
     */
    function getProvider() external pure returns (string memory) {
        return "Pyth Network";
    }

    /**
     * @dev Checks if the oracle supports the given data type
     */
    function supportsDataType(bytes32 dataType) external view returns (bool) {
        return supportedDataTypes[dataType];
    }

    /**
     * @dev Gets latest data for a given data identifier
     */
    function getLatestData(bytes32 dataId) external view returns (OracleData memory) {
        // Convert dataId to symbol and get price
        string memory symbol = string(abi.encodePacked(dataId));
        bytes32 priceId = priceIds[symbol];
        
        require(priceId != bytes32(0), "Price ID not found");
        
        // Check cache first
        CachedPrice memory cached = priceCache[priceId];
        if (cached.valid && block.timestamp - cached.timestamp <= STALENESS_THRESHOLD) {
            return OracleData({
                value: cached.price,
                timestamp: cached.timestamp,
                confidence: cached.confidence,
                dataId: dataId,
                source: "Pyth Network (cached)"
            });
        }

        // Get live price from Pyth
        return _getLivePriceData(priceId, dataId);
    }

    /**
     * @dev Gets price data for a given asset pair
     */
    function getPrice(string calldata pair) external view returns (PriceData memory) {
        bytes32 priceId = priceIds[pair];
        require(priceId != bytes32(0), "Price feed not found");

        PriceConfig memory config = priceConfigs[priceId];
        
        // Check cache first for efficiency
        CachedPrice memory cached = priceCache[priceId];
        if (cached.valid && block.timestamp - cached.timestamp <= config.maxStaleness) {
            return PriceData({
                price: cached.price,
                timestamp: cached.timestamp,
                decimals: config.decimals,
                confidence: cached.confidence,
                feedId: priceId
            });
        }

        // Get live price from Pyth contract
        return _getLivePrice(priceId, config);
    }

    /**
     * @dev Resolves a prediction market question using Pyth data
     */
    function resolvePrediction(
        bytes32 questionId,
        bytes calldata params
    ) external returns (ResolutionData memory) {
        (bytes32 dataType, bytes memory data) = abi.decode(params, (bytes32, bytes));
        
        require(dataType == PRICE_DATA || dataType == CRYPTO_DATA, "Unsupported resolution type");
        
        return _resolvePricePrediction(questionId, data);
    }

    /**
     * @dev Estimates the cost for oracle query in wei
     */
    function estimateCost(bytes32 dataType, bytes calldata params) external view returns (uint256) {
        if (dataType == PRICE_DATA || dataType == CRYPTO_DATA) {
            return BASE_COST; // Very efficient for price data
        } else if (dataType == FX_DATA || dataType == COMMODITIES_DATA) {
            return BASE_COST * 2; // Slightly higher for other asset classes
        } else {
            return BASE_COST;
        }
    }

    // ============ Price Feed Management ============

    /**
     * @dev Adds a new price ID
     */
    function addPriceId(
        string calldata symbol,
        bytes32 priceId,
        uint8 decimals
    ) external onlyOwner {
        _addPriceId(symbol, priceId, decimals);
    }

    /**
     * @dev Updates price configuration
     */
    function updatePriceConfig(
        bytes32 priceId,
        uint256 maxStaleness,
        uint256 minConfidence,
        bool isActive
    ) external onlyOwner validPriceId(priceId) {
        PriceConfig storage config = priceConfigs[priceId];
        config.maxStaleness = maxStaleness;
        config.minConfidence = minConfidence;
        config.isActive = isActive;
    }

    /**
     * @dev Batch updates prices with Pyth price update data
     * @param updateData Pyth price update data from off-chain
     */
    function updatePrices(bytes[] calldata updateData) external payable nonReentrant {
        require(updateData.length > 0, "No update data provided");
        
        // Update prices via Pyth contract (requires fee)
        IPyth(PYTH_CONTRACT).updatePriceFeeds{value: msg.value}(updateData);
        
        // Cache the updated prices
        for (uint256 i = 0; i < updateData.length; i++) {
            _cacheUpdatedPrices(updateData[i]);
        }
        
        lastUpdateTime = block.timestamp;
    }

    /**
     * @dev Updates price cache for a specific price ID
     */
    function updatePriceCache(bytes32 priceId) external validPriceId(priceId) {
        _updateSinglePriceCache(priceId);
    }

    // ============ Batch Operations ============

    /**
     * @dev Gets multiple prices in a single call
     */
    function getBatchPrices(string[] calldata pairs) external view returns (PriceData[] memory prices) {
        prices = new PriceData[](pairs.length);
        
        for (uint256 i = 0; i < pairs.length; i++) {
            bytes32 priceId = priceIds[pairs[i]];
            if (priceId != bytes32(0) && priceConfigs[priceId].isActive) {
                try this.getPrice(pairs[i]) returns (PriceData memory priceData) {
                    prices[i] = priceData;
                } catch {
                    // Return empty price data for failed queries
                    prices[i] = PriceData({
                        price: 0,
                        timestamp: 0,
                        decimals: 0,
                        confidence: 0,
                        feedId: bytes32(0)
                    });
                }
            }
        }
    }

    /**
     * @dev Updates multiple price caches efficiently
     */
    function batchUpdatePriceCache(bytes32[] calldata priceIds) external {
        for (uint256 i = 0; i < priceIds.length; i++) {
            if (priceConfigs[priceIds[i]].isActive) {
                _updateSinglePriceCache(priceIds[i]);
            }
        }
    }

    // ============ View Functions ============

    /**
     * @dev Gets price configuration
     */
    function getPriceConfig(bytes32 priceId) external view returns (PriceConfig memory) {
        return priceConfigs[priceId];
    }

    /**
     * @dev Gets cached price data
     */
    function getCachedPrice(bytes32 priceId) external view returns (CachedPrice memory) {
        return priceCache[priceId];
    }

    /**
     * @dev Gets all supported symbols
     */
    function getSupportedSymbols() external view returns (string[] memory symbols) {
        // This would require tracking symbols separately in a real implementation
        // For now, return a static array of common symbols
        symbols = new string[](5);
        symbols[0] = "ETH/USD";
        symbols[1] = "BTC/USD";
        symbols[2] = "USDC/USD";
        symbols[3] = "USDT/USD";
        symbols[4] = "SOL/USD";
    }

    /**
     * @dev Gets adapter statistics
     */
    function getAdapterStats() external view returns (
        uint256 totalRequests_,
        uint256 successfulRequests_,
        uint256 successRate,
        uint256 cacheHitRate_,
        uint256 avgResponseTime,
        uint256 lastUpdate
    ) {
        totalRequests_ = totalRequests;
        successfulRequests_ = successfulRequests;
        successRate = totalRequests > 0 ? (successfulRequests * 10000) / totalRequests : 0;
        cacheHitRate_ = cacheHitRate;
        avgResponseTime = averageResponseTime;
        lastUpdate = lastUpdateTime;
    }

    /**
     * @dev Checks if price data is stale
     */
    function isPriceStale(bytes32 priceId) external view returns (bool) {
        CachedPrice memory cached = priceCache[priceId];
        PriceConfig memory config = priceConfigs[priceId];
        
        return !cached.valid || 
               (block.timestamp - cached.timestamp) > config.maxStaleness;
    }

    // ============ Internal Functions ============

    function _addPriceId(string memory symbol, bytes32 priceId, uint8 decimals) internal {
        require(priceId != bytes32(0), "Invalid price ID");
        require(priceIds[symbol] == bytes32(0), "Symbol already exists");

        priceIds[symbol] = priceId;
        priceConfigs[priceId] = PriceConfig({
            priceId: priceId,
            symbol: symbol,
            decimals: decimals,
            maxStaleness: STALENESS_THRESHOLD,
            minConfidence: MIN_CONFIDENCE,
            isActive: true
        });

        emit PriceIdAdded(symbol, priceId);
    }

    function _getLivePriceData(bytes32 priceId, bytes32 dataId) internal view returns (OracleData memory) {
        try IPyth(PYTH_CONTRACT).getPrice(priceId) returns (PythPrice memory pythPrice) {
            require(pythPrice.publishTime > 0, "Invalid price data");
            require(block.timestamp - pythPrice.publishTime <= STALENESS_THRESHOLD, "Price data stale");

            uint256 price = _convertPythPrice(pythPrice.price, pythPrice.expo);
            uint256 confidence = _convertPythConfidence(pythPrice.conf, pythPrice.expo);

            return OracleData({
                value: price,
                timestamp: pythPrice.publishTime,
                confidence: confidence,
                dataId: dataId,
                source: "Pyth Network"
            });
        } catch {
            revert("Failed to get live price");
        }
    }

    function _getLivePrice(bytes32 priceId, PriceConfig memory config) internal view returns (PriceData memory) {
        try IPyth(PYTH_CONTRACT).getPrice(priceId) returns (PythPrice memory pythPrice) {
            require(pythPrice.publishTime > 0, "Invalid price data");
            require(block.timestamp - pythPrice.publishTime <= config.maxStaleness, "Price data stale");

            uint256 price = _convertPythPrice(pythPrice.price, pythPrice.expo);
            uint256 confidence = _convertPythConfidence(pythPrice.conf, pythPrice.expo);
            
            require(confidence >= config.minConfidence, "Confidence too low");

            return PriceData({
                price: price,
                timestamp: pythPrice.publishTime,
                decimals: config.decimals,
                confidence: confidence,
                feedId: priceId
            });
        } catch {
            revert("Failed to get live price");
        }
    }

    function _updateSinglePriceCache(bytes32 priceId) internal {
        try IPyth(PYTH_CONTRACT).getPrice(priceId) returns (PythPrice memory pythPrice) {
            if (pythPrice.publishTime > 0 && 
                block.timestamp - pythPrice.publishTime <= STALENESS_THRESHOLD) {
                
                priceCache[priceId] = CachedPrice({
                    price: _convertPythPrice(pythPrice.price, pythPrice.expo),
                    confidence: _convertPythConfidence(pythPrice.conf, pythPrice.expo),
                    timestamp: pythPrice.publishTime,
                    expo: pythPrice.expo,
                    valid: true
                });

                emit PriceUpdated(priceId, priceCache[priceId].price, 
                                priceCache[priceId].confidence, pythPrice.publishTime);
            }
        } catch {
            // Mark cache as invalid on failure
            priceCache[priceId].valid = false;
        }
    }

    function _cacheUpdatedPrices(bytes memory updateData) internal {
        // This would parse the update data and cache relevant prices
        // Implementation would depend on Pyth's update data format
        // For now, we'll update the lastUpdateTime
        lastUpdateTime = block.timestamp;
    }

    function _convertPythPrice(int64 price, int32 expo) internal pure returns (uint256) {
        require(price > 0, "Invalid price");
        
        uint256 absPrice = uint256(int256(price));
        
        if (expo >= 0) {
            return absPrice * (10 ** uint32(expo));
        } else {
            return absPrice / (10 ** uint32(-expo));
        }
    }

    function _convertPythConfidence(uint64 conf, int32 expo) internal pure returns (uint256) {
        // Convert confidence to percentage (0-10000 scale)
        uint256 confValue = uint256(conf);
        
        if (expo >= 0) {
            confValue = confValue * (10 ** uint32(expo));
        } else {
            confValue = confValue / (10 ** uint32(-expo));
        }
        
        // Convert to percentage and cap at 10000 (100%)
        uint256 confidencePercent = (confValue * 10000) / CONFIDENCE_MULTIPLIER;
        return confidencePercent > 10000 ? 10000 : confidencePercent;
    }

    function _resolvePricePrediction(
        bytes32 questionId,
        bytes memory data
    ) internal returns (ResolutionData memory) {
        (string memory pair, uint256 targetPrice, bool isAbove, uint256 resolveTime) = 
            abi.decode(data, (string, uint256, bool, uint256));

        bytes32 priceId = priceIds[pair];
        require(priceId != bytes32(0), "Price feed not found");

        // Get price at resolution time (or current if resolveTime is 0)
        PythPrice memory pythPrice;
        
        if (resolveTime == 0 || resolveTime >= block.timestamp) {
            pythPrice = IPyth(PYTH_CONTRACT).getPrice(priceId);
        } else {
            // For historical prices, we'd need to implement price history
            // For now, use current price with timestamp check
            pythPrice = IPyth(PYTH_CONTRACT).getPrice(priceId);
            require(pythPrice.publishTime >= resolveTime, "No price data for resolution time");
        }

        uint256 resolvePrice = _convertPythPrice(pythPrice.price, pythPrice.expo);
        bool conditionMet = isAbove ? 
            resolvePrice >= targetPrice : 
            resolvePrice <= targetPrice;

        return ResolutionData({
            result: conditionMet ? 1 : 0,
            resolved: true,
            timestamp: block.timestamp,
            proof: abi.encode(pythPrice),
            metadata: string(abi.encodePacked("Pyth price resolution for ", pair))
        });
    }
}

/**
 * @title IPyth
 * @dev Interface for Pyth Network price feeds
 */
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    function getPrice(bytes32 id) external view returns (Price memory price);
    function getPriceUnsafe(bytes32 id) external view returns (Price memory price);
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 feeAmount);
}