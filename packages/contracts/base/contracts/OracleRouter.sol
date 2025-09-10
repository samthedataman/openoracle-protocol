// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title OracleRouter
 * @dev Enhanced oracle router optimized for Base L2 with multi-provider support
 * @notice Routes prediction questions to optimal oracle providers with fallback mechanisms
 */
contract OracleRouter is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ Constants ============
    uint256 public constant MAX_ROUTE_ATTEMPTS = 3;
    uint256 public constant CONFIDENCE_THRESHOLD = 7000; // 70% scaled by 1e4
    uint256 public constant STALENESS_THRESHOLD = 1 hours;
    uint256 public constant BASE_CHAIN_ID = 8453;
    
    // Route scoring weights
    uint256 public constant RELIABILITY_WEIGHT = 4000; // 40%
    uint256 public constant COST_WEIGHT = 3000;       // 30% 
    uint256 public constant SPEED_WEIGHT = 2000;      // 20%
    uint256 public constant FRESHNESS_WEIGHT = 1000;  // 10%

    // ============ Data Types ============
    bytes32 public constant PRICE_DATA = keccak256("PRICE_DATA");
    bytes32 public constant SPORTS_DATA = keccak256("SPORTS_DATA");
    bytes32 public constant WEATHER_DATA = keccak256("WEATHER_DATA");
    bytes32 public constant CUSTOM_DATA = keccak256("CUSTOM_DATA");
    bytes32 public constant ELECTION_DATA = keccak256("ELECTION_DATA");
    bytes32 public constant EVENT_DATA = keccak256("EVENT_DATA");

    // ============ Enums ============
    enum OracleProvider {
        CHAINLINK,
        PYTH,
        UMA,
        API3,
        CUSTOM
    }

    // ============ Structs ============
    struct RouteConfig {
        OracleProvider provider;
        address oracleAddress;
        uint256 priority;
        uint256 maxCost;
        uint256 avgResponseTime;
        uint256 reliabilityScore; // 0-10000 scale
        bool isActive;
        bytes32[] supportedDataTypes;
    }

    struct RouteResult {
        bool success;
        OracleProvider selectedProvider;
        address oracleAddress;
        uint256 estimatedCost;
        uint256 estimatedTime;
        string reason;
    }

    struct OraclePerformance {
        uint256 totalRequests;
        uint256 successfulRequests;
        uint256 avgResponseTime;
        uint256 lastUpdate;
        uint256 totalCost;
    }

    struct DataTypePreference {
        bytes32 dataType;
        OracleProvider[] preferredProviders;
        address[] fallbackOracles;
    }

    // ============ State Variables ============
    mapping(OracleProvider => RouteConfig) public oracleConfigs;
    mapping(address => OracleProvider) public oracleToProvider;
    mapping(OracleProvider => address) public providerToOracle;
    mapping(bytes32 => EnumerableSet.AddressSet) private dataTypeOracles;
    mapping(bytes32 => address) public defaultOracles;
    mapping(address => OraclePerformance) public oraclePerformance;
    mapping(bytes32 => DataTypePreference) public dataTypePreferences;
    
    EnumerableSet.AddressSet private allOracles;
    
    uint256 public totalRoutes;
    uint256 public successfulRoutes;
    uint256 public averageRoutingCost;
    
    // Base L2 specific optimizations
    mapping(address => uint256) public oracleBaseOptimization; // Gas optimization scores
    mapping(bytes32 => uint256) public dataTypeCachePeriod;
    mapping(bytes32 => CachedResult) public cachedResults;

    // ============ Events ============
    event OracleAdded(
        OracleProvider indexed provider,
        address indexed oracleAddress,
        uint256 priority,
        bytes32[] supportedDataTypes
    );
    
    event OracleUpdated(
        OracleProvider indexed provider,
        address indexed oracleAddress,
        uint256 newPriority,
        bool isActive
    );
    
    event RouteExecuted(
        bytes32 indexed dataType,
        OracleProvider selectedProvider,
        address oracleAddress,
        uint256 cost,
        uint256 responseTime,
        bool success
    );
    
    event PerformanceUpdated(
        address indexed oracle,
        uint256 newReliabilityScore,
        uint256 avgResponseTime
    );
    
    event DataTypePreferenceSet(
        bytes32 indexed dataType,
        OracleProvider[] preferredProviders
    );

    event FallbackTriggered(
        bytes32 indexed dataType,
        address failedOracle,
        address fallbackOracle
    );

    // ============ Modifiers ============
    modifier validOracle(address oracle) {
        require(oracle != address(0), "Invalid oracle address");
        require(allOracles.contains(oracle), "Oracle not registered");
        _;
    }

    modifier validProvider(OracleProvider provider) {
        require(uint256(provider) <= uint256(OracleProvider.CUSTOM), "Invalid provider");
        _;
    }

    modifier validDataType(bytes32 dataType) {
        require(dataType != bytes32(0), "Invalid data type");
        _;
    }

    // ============ Constructor ============
    constructor() {
        // Set default cache periods for different data types
        dataTypeCachePeriod[PRICE_DATA] = 5 minutes;
        dataTypeCachePeriod[SPORTS_DATA] = 30 minutes;
        dataTypeCachePeriod[WEATHER_DATA] = 15 minutes;
        dataTypeCachePeriod[CUSTOM_DATA] = 10 minutes;
        dataTypeCachePeriod[ELECTION_DATA] = 1 hours;
        dataTypeCachePeriod[EVENT_DATA] = 1 hours;
    }

    // ============ Core Routing Functions ============

    /**
     * @dev Routes a prediction question to the optimal oracle on Base L2
     * @param question The prediction question
     * @param dataType Type of data needed for resolution
     * @param maxCost Maximum acceptable cost in wei
     * @param urgency Whether this is an urgent request (affects provider selection)
     * @return result Routing result with selected oracle
     */
    function routeQuestion(
        string calldata question,
        bytes32 dataType,
        uint256 maxCost,
        bool urgency
    ) external view returns (RouteResult memory result) {
        // Check cache first for non-urgent requests
        if (!urgency && _hasCachedResult(dataType, question)) {
            CachedResult memory cached = cachedResults[keccak256(abi.encodePacked(dataType, question))];
            if (block.timestamp - cached.timestamp < dataTypeCachePeriod[dataType]) {
                return RouteResult({
                    success: true,
                    selectedProvider: OracleProvider.CUSTOM,
                    oracleAddress: cached.oracle,
                    estimatedCost: 0, // Cached results are free
                    estimatedTime: 0,
                    reason: "Cached result available"
                });
            }
        }

        // Get preferred providers for this data type
        address[] memory candidates = _getPreferredOracles(dataType);
        
        if (candidates.length == 0) {
            // Fallback to any available oracle
            candidates = _getDataTypeOracles(dataType);
        }

        if (candidates.length == 0) {
            return RouteResult({
                success: false,
                selectedProvider: OracleProvider.CUSTOM,
                oracleAddress: address(0),
                estimatedCost: 0,
                estimatedTime: 0,
                reason: "No oracles available for data type"
            });
        }

        // Find optimal oracle using enhanced scoring
        (address bestOracle, uint256 cost, uint256 time, string memory reason) = 
            _findOptimalOracle(candidates, dataType, maxCost, urgency);

        if (bestOracle == address(0)) {
            return RouteResult({
                success: false,
                selectedProvider: OracleProvider.CUSTOM,
                oracleAddress: address(0),
                estimatedCost: cost,
                estimatedTime: time,
                reason: reason
            });
        }

        return RouteResult({
            success: true,
            selectedProvider: oracleToProvider[bestOracle],
            oracleAddress: bestOracle,
            estimatedCost: cost,
            estimatedTime: time,
            reason: reason
        });
    }

    /**
     * @dev Gets the best oracle for a data type with fallback support
     * @param dataType The data type to resolve
     * @param allowFallback Whether to allow fallback oracles
     * @return oracle The selected oracle address
     */
    function getBestOracle(bytes32 dataType, bool allowFallback) 
        external 
        view 
        returns (address oracle) 
    {
        // Try default oracle first
        oracle = defaultOracles[dataType];
        if (oracle != address(0) && _isOracleActive(oracle)) {
            return oracle;
        }

        // Try preferred providers
        address[] memory preferred = _getPreferredOracles(dataType);
        if (preferred.length > 0) {
            for (uint256 i = 0; i < preferred.length; i++) {
                if (_isOracleActive(preferred[i])) {
                    return preferred[i];
                }
            }
        }

        // Fallback to any available oracle
        if (allowFallback) {
            address[] memory candidates = _getDataTypeOracles(dataType);
            for (uint256 i = 0; i < candidates.length; i++) {
                if (_isOracleActive(candidates[i])) {
                    return candidates[i];
                }
            }
        }

        return address(0);
    }

    /**
     * @dev Gets consensus data from multiple oracles
     * @param dataType The data type to query
     * @param dataId The specific data identifier
     * @param minResponses Minimum number of responses required
     * @param maxDeviation Maximum allowed deviation between responses (basis points)
     * @return consensusValue The consensus value
     * @return confidence The confidence level (0-10000)
     * @return participatingOracles Oracles that provided valid responses
     */
    function getConsensusData(
        bytes32 dataType,
        bytes32 dataId,
        uint256 minResponses,
        uint256 maxDeviation
    ) external view returns (
        uint256 consensusValue,
        uint256 confidence,
        address[] memory participatingOracles
    ) {
        address[] memory oracles = _getDataTypeOracles(dataType);
        require(oracles.length >= minResponses, "Insufficient oracles");

        uint256[] memory values = new uint256[](oracles.length);
        address[] memory validOracles = new address[](oracles.length);
        uint256 validCount = 0;

        // Collect responses from all oracles
        for (uint256 i = 0; i < oracles.length; i++) {
            if (_isOracleActive(oracles[i])) {
                try IOracle(oracles[i]).getLatestData(dataId) returns (IOracle.OracleData memory data) {
                    if (data.timestamp > block.timestamp - STALENESS_THRESHOLD && data.confidence >= CONFIDENCE_THRESHOLD) {
                        values[validCount] = data.value;
                        validOracles[validCount] = oracles[i];
                        validCount++;
                    }
                } catch {
                    continue;
                }
            }
        }

        require(validCount >= minResponses, "Insufficient valid responses");

        // Calculate consensus using weighted median
        (consensusValue, confidence) = _calculateWeightedConsensus(values, validOracles, validCount, maxDeviation);

        // Resize participating oracles array
        participatingOracles = new address[](validCount);
        for (uint256 i = 0; i < validCount; i++) {
            participatingOracles[i] = validOracles[i];
        }
    }

    // ============ Oracle Management ============

    /**
     * @dev Adds a new oracle with Base L2 optimizations
     */
    function addOracle(
        OracleProvider provider,
        address oracleAddress,
        uint256 priority,
        bytes32[] calldata supportedDataTypes,
        uint256 baseOptimizationScore
    ) external onlyOwner validProvider(provider) {
        require(oracleAddress != address(0), "Invalid oracle address");
        require(!allOracles.contains(oracleAddress), "Oracle already exists");
        require(providerToOracle[provider] == address(0), "Provider already registered");
        require(supportedDataTypes.length > 0, "No supported data types");

        // Initialize configuration
        oracleConfigs[provider] = RouteConfig({
            provider: provider,
            oracleAddress: oracleAddress,
            priority: priority,
            maxCost: type(uint256).max,
            avgResponseTime: 30 seconds, // Default
            reliabilityScore: 8000, // Start with 80%
            isActive: true,
            supportedDataTypes: supportedDataTypes
        });

        // Set mappings
        oracleToProvider[oracleAddress] = provider;
        providerToOracle[provider] = oracleAddress;
        allOracles.add(oracleAddress);
        oracleBaseOptimization[oracleAddress] = baseOptimizationScore;

        // Register for data types
        for (uint256 i = 0; i < supportedDataTypes.length; i++) {
            dataTypeOracles[supportedDataTypes[i]].add(oracleAddress);
        }

        // Initialize performance tracking
        oraclePerformance[oracleAddress] = OraclePerformance({
            totalRequests: 0,
            successfulRequests: 0,
            avgResponseTime: 30 seconds,
            lastUpdate: block.timestamp,
            totalCost: 0
        });

        emit OracleAdded(provider, oracleAddress, priority, supportedDataTypes);
    }

    /**
     * @dev Sets data type preferences for optimal routing
     */
    function setDataTypePreferences(
        bytes32 dataType,
        OracleProvider[] calldata preferredProviders,
        address[] calldata fallbackOracles
    ) external onlyOwner validDataType(dataType) {
        require(preferredProviders.length > 0, "Need preferred providers");

        dataTypePreferences[dataType] = DataTypePreference({
            dataType: dataType,
            preferredProviders: preferredProviders,
            fallbackOracles: fallbackOracles
        });

        emit DataTypePreferenceSet(dataType, preferredProviders);
    }

    /**
     * @dev Updates oracle performance metrics (called after oracle responses)
     */
    function updateOraclePerformance(
        address oracle,
        bool success,
        uint256 responseTime,
        uint256 cost
    ) external validOracle(oracle) {
        OraclePerformance storage perf = oraclePerformance[oracle];
        RouteConfig storage config = oracleConfigs[oracleToProvider[oracle]];

        perf.totalRequests++;
        perf.totalCost += cost;

        if (success) {
            perf.successfulRequests++;
        }

        // Update average response time (exponential moving average)
        perf.avgResponseTime = (perf.avgResponseTime * 9 + responseTime) / 10;
        config.avgResponseTime = perf.avgResponseTime;

        // Update reliability score
        uint256 successRate = (perf.successfulRequests * 10000) / perf.totalRequests;
        config.reliabilityScore = successRate;

        perf.lastUpdate = block.timestamp;

        emit PerformanceUpdated(oracle, successRate, perf.avgResponseTime);
    }

    /**
     * @dev Caches oracle result for efficiency
     */
    function cacheResult(
        bytes32 dataType,
        string calldata question,
        address oracle,
        uint256 result,
        uint256 confidence
    ) external validOracle(oracle) {
        bytes32 key = keccak256(abi.encodePacked(dataType, question));
        cachedResults[key] = CachedResult({
            result: result,
            confidence: confidence,
            timestamp: block.timestamp,
            oracle: oracle
        });
    }

    // ============ View Functions ============

    /**
     * @dev Gets all active oracles for a data type
     */
    function getActiveOracles(bytes32 dataType) external view returns (address[] memory) {
        address[] memory allForType = _getDataTypeOracles(dataType);
        uint256 activeCount = 0;

        // Count active oracles
        for (uint256 i = 0; i < allForType.length; i++) {
            if (_isOracleActive(allForType[i])) {
                activeCount++;
            }
        }

        // Build active oracles array
        address[] memory activeOracles = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allForType.length; i++) {
            if (_isOracleActive(allForType[i])) {
                activeOracles[index++] = allForType[i];
            }
        }

        return activeOracles;
    }

    /**
     * @dev Gets comprehensive oracle information
     */
    function getOracleInfo(address oracle) external view validOracle(oracle) returns (
        OracleProvider provider,
        RouteConfig memory config,
        OraclePerformance memory performance,
        uint256 baseOptimization
    ) {
        provider = oracleToProvider[oracle];
        config = oracleConfigs[provider];
        performance = oraclePerformance[oracle];
        baseOptimization = oracleBaseOptimization[oracle];
    }

    /**
     * @dev Gets routing statistics
     */
    function getRoutingStats() external view returns (
        uint256 totalRoutes_,
        uint256 successfulRoutes_,
        uint256 successRate,
        uint256 avgCost,
        uint256 activeOracles
    ) {
        totalRoutes_ = totalRoutes;
        successfulRoutes_ = successfulRoutes;
        successRate = totalRoutes > 0 ? (successfulRoutes * 10000) / totalRoutes : 0;
        avgCost = averageRoutingCost;
        activeOracles = _countActiveOracles();
    }

    // ============ Internal Functions ============

    function _findOptimalOracle(
        address[] memory candidates,
        bytes32 dataType,
        uint256 maxCost,
        bool urgency
    ) internal view returns (address bestOracle, uint256 lowestCost, uint256 estimatedTime, string memory reason) {
        uint256 bestScore = 0;
        lowestCost = type(uint256).max;
        estimatedTime = type(uint256).max;

        for (uint256 i = 0; i < candidates.length; i++) {
            address oracle = candidates[i];
            
            if (!_isOracleActive(oracle)) continue;

            try IOracle(oracle).estimateCost(dataType, "") returns (uint256 cost) {
                if (cost > maxCost) continue;

                RouteConfig memory config = oracleConfigs[oracleToProvider[oracle]];
                OraclePerformance memory perf = oraclePerformance[oracle];

                // Calculate composite score
                uint256 score = _calculateOracleScore(config, perf, cost, maxCost, urgency);

                if (score > bestScore || (score == bestScore && cost < lowestCost)) {
                    bestScore = score;
                    bestOracle = oracle;
                    lowestCost = cost;
                    estimatedTime = config.avgResponseTime;
                }
            } catch {
                continue;
            }
        }

        if (bestOracle == address(0)) {
            reason = "No suitable oracle within constraints";
        } else {
            reason = "Optimal oracle selected based on composite score";
        }
    }

    function _calculateOracleScore(
        RouteConfig memory config,
        OraclePerformance memory perf,
        uint256 cost,
        uint256 maxCost,
        bool urgency
    ) internal view returns (uint256 score) {
        // Reliability component (0-10000)
        uint256 reliabilityComponent = (config.reliabilityScore * RELIABILITY_WEIGHT) / 10000;

        // Cost component (0-10000, inverted so lower cost = higher score)
        uint256 costComponent = maxCost > 0 ? 
            ((maxCost - cost) * COST_WEIGHT) / maxCost : COST_WEIGHT;

        // Speed component (0-10000, inverted so faster = higher score)
        uint256 speedComponent = config.avgResponseTime > 0 ?
            (60 * SPEED_WEIGHT) / (config.avgResponseTime / 1 seconds) : SPEED_WEIGHT;
        if (speedComponent > SPEED_WEIGHT) speedComponent = SPEED_WEIGHT;

        // Freshness component based on last update
        uint256 timeSinceUpdate = block.timestamp - perf.lastUpdate;
        uint256 freshnessComponent = timeSinceUpdate < 1 hours ?
            FRESHNESS_WEIGHT - (timeSinceUpdate * FRESHNESS_WEIGHT / 1 hours) : 0;

        // Base L2 optimization bonus
        uint256 baseOptimizationBonus = oracleBaseOptimization[config.oracleAddress];

        // Urgency adjustments
        if (urgency) {
            speedComponent = (speedComponent * 150) / 100; // 50% boost for speed
            costComponent = (costComponent * 80) / 100;    // 20% penalty for cost
        }

        score = reliabilityComponent + costComponent + speedComponent + 
                freshnessComponent + baseOptimizationBonus;
    }

    function _getPreferredOracles(bytes32 dataType) internal view returns (address[] memory) {
        DataTypePreference memory pref = dataTypePreferences[dataType];
        address[] memory preferred = new address[](pref.preferredProviders.length);
        uint256 count = 0;

        for (uint256 i = 0; i < pref.preferredProviders.length; i++) {
            address oracle = providerToOracle[pref.preferredProviders[i]];
            if (oracle != address(0) && _isOracleActive(oracle)) {
                preferred[count++] = oracle;
            }
        }

        // Resize array
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = preferred[i];
        }

        return result;
    }

    function _getDataTypeOracles(bytes32 dataType) internal view returns (address[] memory) {
        uint256 length = dataTypeOracles[dataType].length();
        address[] memory oracles = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            oracles[i] = dataTypeOracles[dataType].at(i);
        }

        return oracles;
    }

    function _isOracleActive(address oracle) internal view returns (bool) {
        OracleProvider provider = oracleToProvider[oracle];
        return oracleConfigs[provider].isActive;
    }

    function _hasCachedResult(bytes32 dataType, string memory question) internal view returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(dataType, question));
        return cachedResults[key].timestamp > 0;
    }

    function _calculateWeightedConsensus(
        uint256[] memory values,
        address[] memory oracles,
        uint256 validCount,
        uint256 maxDeviation
    ) internal view returns (uint256 consensusValue, uint256 confidence) {
        if (validCount == 1) {
            return (values[0], 5000); // 50% confidence for single oracle
        }

        // Calculate weighted median based on oracle reliability
        uint256[] memory weights = new uint256[](validCount);
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < validCount; i++) {
            weights[i] = oracleConfigs[oracleToProvider[oracles[i]]].reliabilityScore;
            totalWeight += weights[i];
        }

        // Sort values with weights
        for (uint256 i = 0; i < validCount - 1; i++) {
            for (uint256 j = 0; j < validCount - i - 1; j++) {
                if (values[j] > values[j + 1]) {
                    (values[j], values[j + 1]) = (values[j + 1], values[j]);
                    (weights[j], weights[j + 1]) = (weights[j + 1], weights[j]);
                }
            }
        }

        // Find weighted median
        uint256 cumulativeWeight = 0;
        uint256 medianWeight = totalWeight / 2;

        for (uint256 i = 0; i < validCount; i++) {
            cumulativeWeight += weights[i];
            if (cumulativeWeight >= medianWeight) {
                consensusValue = values[i];
                break;
            }
        }

        // Calculate confidence based on deviation
        confidence = _calculateConsensusConfidence(values, validCount, consensusValue, maxDeviation);
    }

    function _calculateConsensusConfidence(
        uint256[] memory values,
        uint256 validCount,
        uint256 consensusValue,
        uint256 maxDeviation
    ) internal pure returns (uint256 confidence) {
        uint256 deviationsWithinThreshold = 0;
        
        for (uint256 i = 0; i < validCount; i++) {
            uint256 deviation = values[i] > consensusValue ? 
                values[i] - consensusValue : consensusValue - values[i];
            
            if (consensusValue > 0 && (deviation * 10000 / consensusValue) <= maxDeviation) {
                deviationsWithinThreshold++;
            }
        }

        // Confidence based on consensus ratio
        confidence = (deviationsWithinThreshold * 10000) / validCount;
        
        // Bonus for more oracles
        if (validCount >= 5) confidence = (confidence * 110) / 100;
        else if (validCount >= 3) confidence = (confidence * 105) / 100;
        
        if (confidence > 10000) confidence = 10000;
    }

    function _countActiveOracles() internal view returns (uint256 count) {
        address[] memory all = allOracles.values();
        for (uint256 i = 0; i < all.length; i++) {
            if (_isOracleActive(all[i])) {
                count++;
            }
        }
    }

    // ============ Data Structures ============
    
    struct CachedResult {
        uint256 result;
        uint256 confidence;
        uint256 timestamp;
        address oracle;
    }
}

/**
 * @title IOracle
 * @dev Interface for oracle adapters
 */
interface IOracle {
    struct OracleData {
        uint256 value;
        uint256 timestamp;
        uint256 confidence;
        bytes32 dataId;
        string source;
    }

    struct ResolutionData {
        uint256 result;
        bool resolved;
        uint256 timestamp;
        bytes proof;
        string metadata;
    }

    function getProvider() external pure returns (string memory);
    function supportsDataType(bytes32 dataType) external view returns (bool);
    function getLatestData(bytes32 dataId) external view returns (OracleData memory);
    function resolvePrediction(bytes32 questionId, bytes calldata params) external returns (ResolutionData memory);
    function estimateCost(bytes32 dataType, bytes calldata params) external view returns (uint256);
}