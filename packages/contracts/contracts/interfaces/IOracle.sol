// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOracle
 * @dev Base interface for all oracle adapters
 */
interface IOracle {
    struct OracleData {
        uint256 value;
        uint256 timestamp;
        uint256 confidence; // Scaled by 1e4 (10000 = 100%)
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
    
    /**
     * @dev Returns the oracle provider identifier
     */
    function getProvider() external pure returns (string memory);
    
    /**
     * @dev Checks if the oracle supports the given data type
     */
    function supportsDataType(bytes32 dataType) external view returns (bool);
    
    /**
     * @dev Gets latest data for a given data identifier
     */
    function getLatestData(bytes32 dataId) external view returns (OracleData memory);
    
    /**
     * @dev Gets price data for a given asset pair
     */
    function getPrice(string calldata pair) external view returns (PriceData memory);
    
    /**
     * @dev Resolves a prediction market question
     */
    function resolvePrediction(
        bytes32 questionId,
        bytes calldata params
    ) external returns (ResolutionData memory);
    
    /**
     * @dev Estimates the cost for oracle query in wei
     */
    function estimateCost(bytes32 dataType, bytes calldata params) external view returns (uint256);
}

/**
 * @title IOracleRouter
 * @dev Interface for the main oracle router contract
 */
interface IOracleRouter {
    enum OracleProvider {
        CHAINLINK,
        PYTH,
        UMA,
        API3,
        CUSTOM
    }
    
    struct RouteConfig {
        OracleProvider provider;
        address oracleAddress;
        uint256 priority;
        uint256 maxCost;
        bool isActive;
    }
    
    struct RouteResult {
        bool success;
        OracleProvider selectedProvider;
        address oracleAddress;
        uint256 estimatedCost;
        string reason;
    }
    
    /**
     * @dev Routes a prediction market question to the best oracle
     */
    function routeQuestion(
        string calldata question,
        bytes32 dataType,
        uint256 maxCost
    ) external view returns (RouteResult memory);
    
    /**
     * @dev Gets the best oracle for specific data type
     */
    function getBestOracle(bytes32 dataType) external view returns (address);
    
    /**
     * @dev Adds a new oracle provider
     */
    function addOracle(
        OracleProvider provider,
        address oracleAddress,
        uint256 priority
    ) external;
    
    /**
     * @dev Updates oracle configuration
     */
    function updateOracle(
        OracleProvider provider,
        address oracleAddress,
        uint256 priority,
        bool isActive
    ) external;
}

/**
 * @title IPredictionMarket
 * @dev Interface for oracle-integrated prediction markets
 */
interface IPredictionMarket {
    enum MarketStatus {
        ACTIVE,
        RESOLVED,
        CANCELLED,
        DISPUTED
    }
    
    struct Market {
        uint256 marketId;
        string question;
        address creator;
        uint256 endTime;
        MarketStatus status;
        uint256 totalPool;
        address paymentToken;
        bytes32 oracleDataType;
        address assignedOracle;
        bytes oracleParams;
    }
    
    struct Position {
        uint256 amount;
        uint8 outcome;
        uint256 timestamp;
        uint256 multiplier;
    }
    
    /**
     * @dev Creates a new prediction market with oracle integration
     */
    function createMarket(
        string calldata question,
        string[] calldata outcomes,
        uint256 duration,
        address paymentToken,
        bytes32 oracleDataType,
        bytes calldata oracleParams
    ) external returns (uint256 marketId);
    
    /**
     * @dev Places a bet on a specific outcome
     */
    function placeBet(
        uint256 marketId,
        uint8 outcome,
        uint256 amount
    ) external;
    
    /**
     * @dev Resolves market using oracle data
     */
    function resolveMarket(uint256 marketId) external;
    
    /**
     * @dev Claims winnings from resolved market
     */
    function claimWinnings(uint256 marketId) external returns (uint256);
}