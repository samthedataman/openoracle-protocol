// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainlinkOracleAdapter
 * @dev Oracle adapter for integrating with Chainlink price feeds
 * 
 * This adapter provides a standardized interface for accessing Chainlink
 * oracle data within the OpenOracle ecosystem.
 */
contract ChainlinkOracleAdapter is Ownable {
    
    // ============ Types ============
    
    struct PriceFeed {
        address feedAddress;
        uint256 decimals;
        uint256 heartbeat;          // Expected update frequency in seconds
        bool isActive;
        string description;
    }
    
    // ============ Storage ============
    
    mapping(string => PriceFeed) public priceFeeds;
    string[] public supportedPairs;
    
    uint256 public constant MAX_PRICE_AGE = 3600; // 1 hour max age
    
    // ============ Events ============
    
    event PriceFeedAdded(string indexed pair, address feedAddress);
    event PriceFeedUpdated(string indexed pair, address feedAddress);
    event PriceFeedRemoved(string indexed pair);
    
    // ============ Constructor ============
    
    constructor() {
        // Initialize common Chainlink price feeds
        // These can be updated by the owner
    }
    
    // ============ Oracle Adapter Interface ============
    
    /**
     * @dev Execute oracle query (implements IOracleAdapter)
     * @param query The trading pair (e.g., "BTC/USD")
     * @param dataType Type of data (0 = PRICE)
     * @param parameters Additional parameters (unused for price feeds)
     * @return data Encoded price data
     * @return confidence Confidence score based on data freshness
     */
    function query(
        string memory query,
        uint8 dataType,
        bytes memory parameters
    ) external view returns (bytes memory data, uint256 confidence) {
        // Only support price queries for now
        require(dataType == 0, "Only price data supported"); // DataType.PRICE = 0
        
        // Get price feed for the pair
        PriceFeed storage feed = priceFeeds[query];
        require(feed.isActive, "Price feed not available");
        
        // Get latest price from Chainlink
        (uint256 price, uint256 timestamp) = getLatestPrice(feed.feedAddress);
        
        // Calculate confidence based on data age
        confidence = calculateConfidence(timestamp, feed.heartbeat);
        
        // Encode response data
        data = abi.encode(price, timestamp, feed.decimals, query);
        
        return (data, confidence);
    }
    
    // ============ Chainlink Integration ============
    
    /**
     * @dev Get latest price from Chainlink price feed
     */
    function getLatestPrice(address feedAddress) internal view returns (uint256, uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feedAddress);
        
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        require(price > 0, "Invalid price data");
        require(updatedAt > 0, "Price data not available");
        require(
            block.timestamp - updatedAt <= MAX_PRICE_AGE,
            "Price data too old"
        );
        
        return (uint256(price), updatedAt);
    }
    
    /**
     * @dev Calculate confidence score based on data freshness
     */
    function calculateConfidence(uint256 timestamp, uint256 heartbeat) internal view returns (uint256) {
        uint256 age = block.timestamp - timestamp;
        
        if (age <= heartbeat) {
            return 95; // Fresh data = high confidence
        } else if (age <= heartbeat * 2) {
            return 80; // Slightly stale = medium confidence
        } else if (age <= MAX_PRICE_AGE) {
            return 60; // Old but acceptable = low confidence
        } else {
            return 0;  // Too old = no confidence
        }
    }
    
    // ============ Price Feed Management ============
    
    /**
     * @dev Add new price feed
     */
    function addPriceFeed(
        string memory pair,
        address feedAddress,
        uint256 decimals,
        uint256 heartbeat,
        string memory description
    ) external onlyOwner {
        require(feedAddress != address(0), "Invalid feed address");
        require(bytes(pair).length > 0, "Invalid pair");
        
        priceFeeds[pair] = PriceFeed({
            feedAddress: feedAddress,
            decimals: decimals,
            heartbeat: heartbeat,
            isActive: true,
            description: description
        });
        
        // Add to supported pairs if new
        if (!isPairSupported(pair)) {
            supportedPairs.push(pair);
        }
        
        emit PriceFeedAdded(pair, feedAddress);
    }
    
    /**
     * @dev Update existing price feed
     */
    function updatePriceFeed(
        string memory pair,
        address feedAddress,
        uint256 decimals,
        uint256 heartbeat
    ) external onlyOwner {
        require(priceFeeds[pair].feedAddress != address(0), "Price feed not found");
        
        priceFeeds[pair].feedAddress = feedAddress;
        priceFeeds[pair].decimals = decimals;
        priceFeeds[pair].heartbeat = heartbeat;
        
        emit PriceFeedUpdated(pair, feedAddress);
    }
    
    /**
     * @dev Remove price feed
     */
    function removePriceFeed(string memory pair) external onlyOwner {
        require(priceFeeds[pair].feedAddress != address(0), "Price feed not found");
        
        priceFeeds[pair].isActive = false;
        emit PriceFeedRemoved(pair);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Check if trading pair is supported
     */
    function isPairSupported(string memory pair) public view returns (bool) {
        return priceFeeds[pair].feedAddress != address(0) && priceFeeds[pair].isActive;
    }
    
    /**
     * @dev Get all supported trading pairs
     */
    function getSupportedPairs() external view returns (string[] memory) {
        uint256 activeCount = 0;
        
        // Count active pairs
        for (uint256 i = 0; i < supportedPairs.length; i++) {
            if (priceFeeds[supportedPairs[i]].isActive) {
                activeCount++;
            }
        }
        
        // Build active pairs array
        string[] memory activePairs = new string[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < supportedPairs.length; i++) {
            if (priceFeeds[supportedPairs[i]].isActive) {
                activePairs[index] = supportedPairs[i];
                index++;
            }
        }
        
        return activePairs;
    }
    
    /**
     * @dev Get price feed info
     */
    function getPriceFeedInfo(string memory pair) external view returns (
        address feedAddress,
        uint256 decimals,
        uint256 heartbeat,
        bool isActive,
        string memory description
    ) {
        PriceFeed storage feed = priceFeeds[pair];
        return (
            feed.feedAddress,
            feed.decimals,
            feed.heartbeat,
            feed.isActive,
            feed.description
        );
    }
}

/**
 * @title AggregatorV3Interface
 * @dev Interface for Chainlink price feeds
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}