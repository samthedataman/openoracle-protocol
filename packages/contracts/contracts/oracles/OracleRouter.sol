// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IOracle.sol";

/**
 * @title OracleRouter
 * @dev Multi-provider oracle routing with automatic failover and cost optimization
 * @notice Routes prediction market questions to the most appropriate oracle provider
 */
contract OracleRouter is IOracleRouter, Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;
    
    // ============ Constants ============
    uint256 public constant MAX_ROUTE_ATTEMPTS = 3;
    uint256 public constant CONFIDENCE_THRESHOLD = 7000; // 70% scaled by 1e4
    uint256 public constant COST_FACTOR_WEIGHT = 3000; // 30% weight for cost in routing
    uint256 public constant RELIABILITY_WEIGHT = 7000; // 70% weight for reliability
    
    // ============ Data Types ============
    bytes32 public constant PRICE_ROUTING = keccak256("PRICE_ROUTING");
    bytes32 public constant SPORTS_ROUTING = keccak256("SPORTS_ROUTING");
    bytes32 public constant CUSTOM_ROUTING = keccak256("CUSTOM_ROUTING");
    
    // ============ State Variables ============
    mapping(OracleProvider => RouteConfig) public oracleConfigs;
    mapping(bytes32 => EnumerableSet.AddressSet) private dataTypeOracles;
    mapping(address => OracleProvider) public oracleToProvider;
    mapping(OracleProvider => address) public providerToOracle;
    mapping(address => uint256) public oracleReliabilityScores;
    mapping(bytes32 => address) public defaultOracles;
    
    EnumerableSet.AddressSet private allOracles;
    
    uint256 public totalRoutes;
    uint256 public successfulRoutes;
    
    // ============ Events ============
    event OracleAdded(OracleProvider indexed provider, address indexed oracleAddress, uint256 priority);
    event OracleUpdated(OracleProvider indexed provider, address indexed oracleAddress, bool isActive);
    event RouteExecuted(
        bytes32 indexed dataType,
        OracleProvider selectedProvider,
        address oracleAddress,
        uint256 cost,
        bool success
    );
    event DefaultOracleSet(bytes32 indexed dataType, address indexed oracleAddress);
    event ReliabilityUpdated(address indexed oracle, uint256 newScore);
    
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
    
    // ============ Constructor ============
    constructor() {
        // Initialize with high reliability scores
        // These will be updated based on actual performance
    }
    
    // ============ Routing Functions ============
    
    /**
     * @dev Routes a prediction market question to the best available oracle
     */
    function routeQuestion(
        string calldata question,
        bytes32 dataType,
        uint256 maxCost
    ) external view override returns (RouteResult memory) {
        // Get available oracles for this data type
        address[] memory candidates = _getDataTypeOracles(dataType);
        
        if (candidates.length == 0) {
            return RouteResult({
                success: false,
                selectedProvider: OracleProvider.CUSTOM,
                oracleAddress: address(0),
                estimatedCost: 0,
                reason: "No oracles available for data type"
            });
        }
        
        // Find best oracle based on cost, reliability, and availability
        (address bestOracle, uint256 estimatedCost, string memory reason) = 
            _findBestOracle(candidates, dataType, maxCost);
        
        if (bestOracle == address(0)) {
            return RouteResult({
                success: false,
                selectedProvider: OracleProvider.CUSTOM,
                oracleAddress: address(0),
                estimatedCost: estimatedCost,
                reason: reason
            });
        }
        
        OracleProvider provider = oracleToProvider[bestOracle];
        
        return RouteResult({
            success: true,
            selectedProvider: provider,
            oracleAddress: bestOracle,
            estimatedCost: estimatedCost,
            reason: "Successfully routed to optimal oracle"
        });
    }
    
    /**
     * @dev Gets the best oracle for a specific data type
     */
    function getBestOracle(bytes32 dataType) external view override returns (address) {
        address defaultOracle = defaultOracles[dataType];
        if (defaultOracle != address(0) && oracleConfigs[oracleToProvider[defaultOracle]].isActive) {
            return defaultOracle;
        }
        
        address[] memory candidates = _getDataTypeOracles(dataType);
        if (candidates.length == 0) return address(0);
        
        (address bestOracle, , ) = _findBestOracle(candidates, dataType, type(uint256).max);
        return bestOracle;
    }
    
    // ============ Oracle Management ============
    
    /**
     * @dev Adds a new oracle provider
     */
    function addOracle(
        OracleProvider provider,
        address oracleAddress,
        uint256 priority
    ) external override onlyOwner validProvider(provider) {
        require(oracleAddress != address(0), "Invalid oracle address");
        require(!allOracles.contains(oracleAddress), "Oracle already exists");
        require(providerToOracle[provider] == address(0), "Provider already has oracle");
        
        // Add to mappings
        oracleConfigs[provider] = RouteConfig({
            provider: provider,
            oracleAddress: oracleAddress,
            priority: priority,
            maxCost: type(uint256).max,
            isActive: true
        });
        
        oracleToProvider[oracleAddress] = provider;
        providerToOracle[provider] = oracleAddress;
        allOracles.add(oracleAddress);
        oracleReliabilityScores[oracleAddress] = 8000; // Start with 80% reliability
        
        // Register for supported data types
        _registerOracleDataTypes(oracleAddress);
        
        emit OracleAdded(provider, oracleAddress, priority);
    }
    
    /**
     * @dev Updates oracle configuration
     */
    function updateOracle(
        OracleProvider provider,
        address oracleAddress,
        uint256 priority,
        bool isActive
    ) external override onlyOwner validProvider(provider) {
        require(providerToOracle[provider] == oracleAddress, "Oracle-provider mismatch");
        require(allOracles.contains(oracleAddress), "Oracle not found");
        
        oracleConfigs[provider].priority = priority;
        oracleConfigs[provider].isActive = isActive;
        
        emit OracleUpdated(provider, oracleAddress, isActive);
    }
    
    /**
     * @dev Removes an oracle provider
     */
    function removeOracle(OracleProvider provider) external onlyOwner validProvider(provider) {
        address oracleAddress = providerToOracle[provider];
        require(oracleAddress != address(0), "Oracle not found");
        
        // Remove from all mappings
        delete oracleConfigs[provider];
        delete oracleToProvider[oracleAddress];
        delete providerToOracle[provider];
        delete oracleReliabilityScores[oracleAddress];
        allOracles.remove(oracleAddress);
        
        // Remove from data type mappings
        _unregisterOracleDataTypes(oracleAddress);
    }
    
    /**
     * @dev Sets default oracle for a data type
     */
    function setDefaultOracle(bytes32 dataType, address oracleAddress) 
        external 
        onlyOwner 
        validOracle(oracleAddress) 
    {
        require(IOracle(oracleAddress).supportsDataType(dataType), "Oracle doesn't support data type");
        defaultOracles[dataType] = oracleAddress;
        emit DefaultOracleSet(dataType, oracleAddress);
    }
    
    /**
     * @dev Updates oracle reliability score based on performance
     */
    function updateReliability(address oracle, uint256 newScore) 
        external 
        onlyOwner 
        validOracle(oracle) 
    {
        require(newScore <= 10000, "Score too high");
        oracleReliabilityScores[oracle] = newScore;
        emit ReliabilityUpdated(oracle, newScore);
    }
    
    // ============ Multi-Oracle Functions ============
    
    /**
     * @dev Gets data from multiple oracles for consensus
     */
    function getConsensusData(
        bytes32 dataType,
        bytes32 dataId,
        uint256 minResponses
    ) external view returns (
        uint256[] memory values,
        uint256[] memory timestamps,
        address[] memory oracles,
        uint256 consensusValue
    ) {
        address[] memory candidates = _getDataTypeOracles(dataType);
        require(candidates.length >= minResponses, "Not enough oracles");
        
        values = new uint256[](candidates.length);
        timestamps = new uint256[](candidates.length);
        oracles = new address[](candidates.length);
        
        uint256 validResponses = 0;
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < candidates.length; i++) {
            try IOracle(candidates[i]).getLatestData(dataId) returns (IOracle.OracleData memory data) {
                if (data.timestamp > 0 && data.confidence >= CONFIDENCE_THRESHOLD) {
                    values[validResponses] = data.value;
                    timestamps[validResponses] = data.timestamp;
                    oracles[validResponses] = candidates[i];
                    totalValue += data.value;
                    validResponses++;
                }
            } catch {
                // Skip failed oracles
                continue;
            }
        }
        
        require(validResponses >= minResponses, "Not enough valid responses");
        
        // Calculate median as consensus (more robust than mean)
        consensusValue = _calculateMedian(values, validResponses);
        
        // Resize arrays to actual valid responses
        assembly {
            mstore(values, validResponses)
            mstore(timestamps, validResponses)
            mstore(oracles, validResponses)
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Gets all registered oracles
     */
    function getAllOracles() external view returns (address[] memory) {
        return allOracles.values();
    }
    
    /**
     * @dev Gets oracles for specific data type
     */
    function getDataTypeOracles(bytes32 dataType) external view returns (address[] memory) {
        return _getDataTypeOracles(dataType);
    }
    
    /**
     * @dev Gets routing statistics
     */
    function getRoutingStats() external view returns (uint256 total, uint256 successful, uint256 successRate) {
        return (totalRoutes, successfulRoutes, totalRoutes > 0 ? (successfulRoutes * 10000) / totalRoutes : 0);
    }
    
    /**
     * @dev Gets oracle information
     */
    function getOracleInfo(address oracle) external view returns (
        OracleProvider provider,
        uint256 priority,
        uint256 reliability,
        bool isActive,
        string memory providerName
    ) {
        provider = oracleToProvider[oracle];
        RouteConfig memory config = oracleConfigs[provider];
        return (
            provider,
            config.priority,
            oracleReliabilityScores[oracle],
            config.isActive,
            IOracle(oracle).getProvider()
        );
    }
    
    // ============ Internal Functions ============
    
    function _getDataTypeOracles(bytes32 dataType) internal view returns (address[] memory) {
        uint256 length = dataTypeOracles[dataType].length();
        address[] memory oracles = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            oracles[i] = dataTypeOracles[dataType].at(i);
        }
        
        return oracles;
    }
    
    function _findBestOracle(
        address[] memory candidates,
        bytes32 dataType,
        uint256 maxCost
    ) internal view returns (address bestOracle, uint256 lowestCost, string memory reason) {
        uint256 bestScore = 0;
        lowestCost = type(uint256).max;
        
        for (uint256 i = 0; i < candidates.length; i++) {
            address oracle = candidates[i];
            OracleProvider provider = oracleToProvider[oracle];
            
            // Skip inactive oracles
            if (!oracleConfigs[provider].isActive) continue;
            
            try IOracle(oracle).estimateCost(dataType, "") returns (uint256 cost) {
                if (cost > maxCost) continue;
                
                uint256 reliability = oracleReliabilityScores[oracle];
                uint256 priority = oracleConfigs[provider].priority;
                
                // Calculate composite score (higher is better)
                // Score = (reliability * RELIABILITY_WEIGHT + costScore * COST_FACTOR_WEIGHT + priority * 100) / 10000
                uint256 costScore = maxCost > 0 ? ((maxCost - cost) * 10000) / maxCost : 10000;
                uint256 score = (reliability * RELIABILITY_WEIGHT + costScore * COST_FACTOR_WEIGHT + priority * 100) / 10000;
                
                if (score > bestScore || (score == bestScore && cost < lowestCost)) {
                    bestScore = score;
                    bestOracle = oracle;
                    lowestCost = cost;
                    reason = "Optimal oracle selected";
                }
            } catch {
                // Skip oracles that can't estimate cost
                continue;
            }
        }
        
        if (bestOracle == address(0)) {
            reason = "No suitable oracle found within cost constraints";
        }
    }
    
    function _registerOracleDataTypes(address oracle) internal {
        // Register for all supported data types
        bytes32[5] memory dataTypes = [
            keccak256("PRICE"),
            keccak256("SPORTS"), 
            keccak256("WEATHER"),
            keccak256("CUSTOM"),
            keccak256("ELECTION")
        ];
        
        for (uint256 i = 0; i < dataTypes.length; i++) {
            try IOracle(oracle).supportsDataType(dataTypes[i]) returns (bool supported) {
                if (supported) {
                    dataTypeOracles[dataTypes[i]].add(oracle);
                }
            } catch {
                // Skip unsupported data types
                continue;
            }
        }
    }
    
    function _unregisterOracleDataTypes(address oracle) internal {
        bytes32[5] memory dataTypes = [
            keccak256("PRICE"),
            keccak256("SPORTS"),
            keccak256("WEATHER"),
            keccak256("CUSTOM"),
            keccak256("ELECTION")
        ];
        
        for (uint256 i = 0; i < dataTypes.length; i++) {
            dataTypeOracles[dataTypes[i]].remove(oracle);
        }
    }
    
    function _calculateMedian(uint256[] memory values, uint256 length) internal pure returns (uint256) {
        if (length == 0) return 0;
        if (length == 1) return values[0];
        
        // Simple bubble sort for small arrays
        for (uint256 i = 0; i < length - 1; i++) {
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (values[j] > values[j + 1]) {
                    uint256 temp = values[j];
                    values[j] = values[j + 1];
                    values[j + 1] = temp;
                }
            }
        }
        
        if (length % 2 == 0) {
            return (values[length / 2 - 1] + values[length / 2]) / 2;
        } else {
            return values[length / 2];
        }
    }
}