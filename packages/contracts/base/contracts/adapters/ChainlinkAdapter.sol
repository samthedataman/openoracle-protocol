// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ChainlinkAdapter
 * @dev Chainlink oracle adapter optimized for Base L2
 * @notice Handles price feeds, sports data, and custom API calls via Chainlink
 */
contract ChainlinkAdapter is Ownable, ReentrancyGuard {
    
    // ============ Constants ============
    uint256 public constant STALENESS_THRESHOLD = 3600; // 1 hour
    uint256 public constant MIN_CONFIDENCE = 8000; // 80% confidence minimum
    uint256 public constant BASE_COST = 0.001 ether; // Base cost for queries
    
    // Base L2 Chainlink addresses
    address public constant CHAINLINK_REGISTRY = 0x43E37aFE359948d8d2dF34E50c6bC4999c5A8EE1;
    address public constant LINK_TOKEN = 0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196;
    
    // ============ Data Types ============
    bytes32 public constant PRICE_DATA = keccak256("PRICE_DATA");
    bytes32 public constant SPORTS_DATA = keccak256("SPORTS_DATA");
    bytes32 public constant WEATHER_DATA = keccak256("WEATHER_DATA");
    bytes32 public constant CUSTOM_DATA = keccak256("CUSTOM_DATA");

    // ============ State Variables ============
    mapping(string => address) public priceFeeds; // asset pair => feed address
    mapping(bytes32 => SportsGame) public sportsGames;
    mapping(bytes32 => CustomRequest) public customRequests;
    mapping(bytes32 => bool) public supportedDataTypes;
    
    uint256 public totalRequests;
    uint256 public successfulRequests;
    uint256 public averageResponseTime;
    uint256 public totalCostAccrued;

    // ============ Structs ============
    struct PriceFeed {
        address feedAddress;
        uint8 decimals;
        uint256 heartbeat;
        bool isActive;
    }

    struct SportsGame {
        bytes32 gameId;
        string homeTeam;
        string awayTeam;
        uint256 gameTime;
        uint8 status; // 0=scheduled, 1=live, 2=finished
        uint8 homeScore;
        uint8 awayScore;
        bool resolved;
    }

    struct CustomRequest {
        string jobId;
        string url;
        string path;
        uint256 payment;
        bool fulfilled;
        uint256 result;
    }

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

    // ============ Events ============
    event PriceFeedAdded(string indexed pair, address indexed feedAddress);
    event SportsGameAdded(bytes32 indexed gameId, string homeTeam, string awayTeam, uint256 gameTime);
    event CustomRequestCreated(bytes32 indexed requestId, string jobId, string url);
    event DataRequested(bytes32 indexed dataId, bytes32 dataType, uint256 timestamp);
    event DataReceived(bytes32 indexed dataId, uint256 value, uint256 timestamp);

    // ============ Modifiers ============
    modifier validDataType(bytes32 dataType) {
        require(supportedDataTypes[dataType], "Unsupported data type");
        _;
    }

    // ============ Constructor ============
    constructor() {
        // Initialize supported data types
        supportedDataTypes[PRICE_DATA] = true;
        supportedDataTypes[SPORTS_DATA] = true;
        supportedDataTypes[WEATHER_DATA] = true;
        supportedDataTypes[CUSTOM_DATA] = true;

        // Add major Base L2 price feeds
        _addPriceFeed("ETH/USD", 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70);
        _addPriceFeed("BTC/USD", 0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F);
        _addPriceFeed("USDC/USD", 0x7e860098F58bBFC8648a4311b374B1D669a2bc6B);
        _addPriceFeed("LINK/USD", 0xc5E2CDd0aB1F4E838C6B7D7F4E5b3e6b1f9a7C6f);
    }

    // ============ Core Interface Implementation ============

    /**
     * @dev Returns the oracle provider identifier
     */
    function getProvider() external pure returns (string memory) {
        return "Chainlink";
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
        // Determine data type from dataId
        if (_isPriceData(dataId)) {
            return _getPriceData(dataId);
        } else if (_isSportsData(dataId)) {
            return _getSportsData(dataId);
        } else if (_isCustomData(dataId)) {
            return _getCustomData(dataId);
        } else {
            revert("Unsupported data ID");
        }
    }

    /**
     * @dev Gets price data for a given asset pair
     */
    function getPrice(string calldata pair) external view returns (PriceData memory) {
        address feedAddress = priceFeeds[pair];
        require(feedAddress != address(0), "Price feed not found");

        try AggregatorV3Interface(feedAddress).latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(price > 0, "Invalid price");
            require(block.timestamp - updatedAt <= STALENESS_THRESHOLD, "Price data stale");

            uint8 decimals = AggregatorV3Interface(feedAddress).decimals();
            
            return PriceData({
                price: uint256(price),
                timestamp: updatedAt,
                decimals: decimals,
                confidence: _calculatePriceConfidence(updatedAt, roundId, answeredInRound),
                feedId: keccak256(bytes(pair))
            });
        } catch {
            revert("Failed to get price");
        }
    }

    /**
     * @dev Resolves a prediction market question using Chainlink data
     */
    function resolvePrediction(
        bytes32 questionId,
        bytes calldata params
    ) external returns (ResolutionData memory) {
        (bytes32 dataType, bytes memory data) = abi.decode(params, (bytes32, bytes));
        
        if (dataType == PRICE_DATA) {
            return _resolvePricePrediction(questionId, data);
        } else if (dataType == SPORTS_DATA) {
            return _resolveSportsPrediction(questionId, data);
        } else if (dataType == CUSTOM_DATA) {
            return _resolveCustomPrediction(questionId, data);
        } else {
            revert("Unsupported resolution type");
        }
    }

    /**
     * @dev Estimates the cost for oracle query in wei
     */
    function estimateCost(bytes32 dataType, bytes calldata params) external view returns (uint256) {
        if (dataType == PRICE_DATA) {
            return BASE_COST; // Price feeds are relatively cheap
        } else if (dataType == SPORTS_DATA) {
            return BASE_COST * 2; // Sports data requires more computation
        } else if (dataType == CUSTOM_DATA) {
            return BASE_COST * 5; // Custom API calls are most expensive
        } else {
            return BASE_COST;
        }
    }

    // ============ Price Feed Management ============

    /**
     * @dev Adds a new price feed
     */
    function addPriceFeed(string calldata pair, address feedAddress) external onlyOwner {
        _addPriceFeed(pair, feedAddress);
    }

    /**
     * @dev Updates an existing price feed
     */
    function updatePriceFeed(string calldata pair, address newFeedAddress) external onlyOwner {
        require(priceFeeds[pair] != address(0), "Price feed does not exist");
        priceFeeds[pair] = newFeedAddress;
        emit PriceFeedAdded(pair, newFeedAddress);
    }

    /**
     * @dev Removes a price feed
     */
    function removePriceFeed(string calldata pair) external onlyOwner {
        delete priceFeeds[pair];
    }

    // ============ Sports Data Management ============

    /**
     * @dev Adds a sports game for tracking
     */
    function addSportsGame(
        bytes32 gameId,
        string calldata homeTeam,
        string calldata awayTeam,
        uint256 gameTime
    ) external onlyOwner {
        sportsGames[gameId] = SportsGame({
            gameId: gameId,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            gameTime: gameTime,
            status: 0, // Scheduled
            homeScore: 0,
            awayScore: 0,
            resolved: false
        });

        emit SportsGameAdded(gameId, homeTeam, awayTeam, gameTime);
    }

    /**
     * @dev Updates sports game status and scores
     */
    function updateSportsGame(
        bytes32 gameId,
        uint8 status,
        uint8 homeScore,
        uint8 awayScore
    ) external onlyOwner {
        SportsGame storage game = sportsGames[gameId];
        require(game.gameId != bytes32(0), "Game not found");

        game.status = status;
        game.homeScore = homeScore;
        game.awayScore = awayScore;
        
        if (status == 2) { // Finished
            game.resolved = true;
        }
    }

    // ============ Custom Request Management ============

    /**
     * @dev Creates a custom data request
     */
    function createCustomRequest(
        bytes32 requestId,
        string calldata jobId,
        string calldata url,
        string calldata path,
        uint256 payment
    ) external onlyOwner {
        customRequests[requestId] = CustomRequest({
            jobId: jobId,
            url: url,
            path: path,
            payment: payment,
            fulfilled: false,
            result: 0
        });

        emit CustomRequestCreated(requestId, jobId, url);
    }

    /**
     * @dev Fulfills a custom data request (called by Chainlink node)
     */
    function fulfillCustomRequest(
        bytes32 requestId,
        uint256 result
    ) external {
        CustomRequest storage request = customRequests[requestId];
        require(bytes(request.jobId).length > 0, "Request not found");
        require(!request.fulfilled, "Already fulfilled");

        request.result = result;
        request.fulfilled = true;

        emit DataReceived(requestId, result, block.timestamp);
    }

    // ============ View Functions ============

    /**
     * @dev Gets price feed information
     */
    function getPriceFeedInfo(string calldata pair) external view returns (
        address feedAddress,
        uint8 decimals,
        string memory description,
        uint256 latestTimestamp
    ) {
        feedAddress = priceFeeds[pair];
        require(feedAddress != address(0), "Price feed not found");

        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        decimals = feed.decimals();
        description = feed.description();
        (, , , latestTimestamp, ) = feed.latestRoundData();
    }

    /**
     * @dev Gets sports game information
     */
    function getSportsGame(bytes32 gameId) external view returns (SportsGame memory) {
        return sportsGames[gameId];
    }

    /**
     * @dev Gets custom request information
     */
    function getCustomRequest(bytes32 requestId) external view returns (CustomRequest memory) {
        return customRequests[requestId];
    }

    /**
     * @dev Gets adapter statistics
     */
    function getAdapterStats() external view returns (
        uint256 totalRequests_,
        uint256 successfulRequests_,
        uint256 successRate,
        uint256 avgResponseTime,
        uint256 totalCost
    ) {
        totalRequests_ = totalRequests;
        successfulRequests_ = successfulRequests;
        successRate = totalRequests > 0 ? (successfulRequests * 10000) / totalRequests : 0;
        avgResponseTime = averageResponseTime;
        totalCost = totalCostAccrued;
    }

    // ============ Internal Functions ============

    function _addPriceFeed(string memory pair, address feedAddress) internal {
        require(feedAddress != address(0), "Invalid feed address");
        priceFeeds[pair] = feedAddress;
        emit PriceFeedAdded(pair, feedAddress);
    }

    function _isPriceData(bytes32 dataId) internal view returns (bool) {
        // Check if dataId corresponds to a known price pair
        string memory pair = string(abi.encodePacked(dataId));
        return priceFeeds[pair] != address(0);
    }

    function _isSportsData(bytes32 dataId) internal view returns (bool) {
        return sportsGames[dataId].gameId != bytes32(0);
    }

    function _isCustomData(bytes32 dataId) internal view returns (bool) {
        return bytes(customRequests[dataId].jobId).length > 0;
    }

    function _getPriceData(bytes32 dataId) internal view returns (OracleData memory) {
        string memory pair = string(abi.encodePacked(dataId));
        address feedAddress = priceFeeds[pair];
        require(feedAddress != address(0), "Price feed not found");

        try AggregatorV3Interface(feedAddress).latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            return OracleData({
                value: uint256(price),
                timestamp: updatedAt,
                confidence: _calculatePriceConfidence(updatedAt, roundId, answeredInRound),
                dataId: dataId,
                source: "Chainlink Price Feed"
            });
        } catch {
            revert("Failed to get price data");
        }
    }

    function _getSportsData(bytes32 dataId) internal view returns (OracleData memory) {
        SportsGame memory game = sportsGames[dataId];
        require(game.gameId != bytes32(0), "Sports game not found");

        uint256 result = 0;
        if (game.resolved) {
            if (game.homeScore > game.awayScore) {
                result = 1; // Home team wins
            } else if (game.awayScore > game.homeScore) {
                result = 2; // Away team wins
            } else {
                result = 0; // Tie
            }
        }

        return OracleData({
            value: result,
            timestamp: block.timestamp,
            confidence: game.resolved ? 10000 : 0,
            dataId: dataId,
            source: "Chainlink Sports Data"
        });
    }

    function _getCustomData(bytes32 dataId) internal view returns (OracleData memory) {
        CustomRequest memory request = customRequests[dataId];
        require(bytes(request.jobId).length > 0, "Custom request not found");

        return OracleData({
            value: request.result,
            timestamp: block.timestamp,
            confidence: request.fulfilled ? 9000 : 0,
            dataId: dataId,
            source: "Chainlink Custom API"
        });
    }

    function _calculatePriceConfidence(
        uint256 updatedAt,
        uint80 roundId,
        uint80 answeredInRound
    ) internal view returns (uint256) {
        uint256 timeSinceUpdate = block.timestamp - updatedAt;
        
        // Base confidence
        uint256 confidence = 9500; // 95% base confidence for Chainlink
        
        // Reduce confidence based on staleness
        if (timeSinceUpdate > STALENESS_THRESHOLD / 2) {
            confidence -= (timeSinceUpdate * 2000) / STALENESS_THRESHOLD;
        }
        
        // Reduce confidence if round data is inconsistent
        if (roundId != answeredInRound) {
            confidence -= 500; // 5% penalty
        }
        
        return confidence > MIN_CONFIDENCE ? confidence : MIN_CONFIDENCE;
    }

    function _resolvePricePrediction(
        bytes32 questionId,
        bytes memory data
    ) internal returns (ResolutionData memory) {
        (string memory pair, uint256 targetPrice, bool isAbove) = 
            abi.decode(data, (string, uint256, bool));

        PriceData memory priceData = this.getPrice(pair);
        
        bool conditionMet = isAbove ? 
            priceData.price >= targetPrice : 
            priceData.price <= targetPrice;

        return ResolutionData({
            result: conditionMet ? 1 : 0,
            resolved: true,
            timestamp: block.timestamp,
            proof: abi.encode(priceData),
            metadata: string(abi.encodePacked("Price resolution for ", pair))
        });
    }

    function _resolveSportsPrediction(
        bytes32 questionId,
        bytes memory data
    ) internal view returns (ResolutionData memory) {
        bytes32 gameId = abi.decode(data, (bytes32));
        SportsGame memory game = sportsGames[gameId];
        
        require(game.resolved, "Game not resolved");

        uint256 result = 0; // Tie
        if (game.homeScore > game.awayScore) {
            result = 1; // Home wins
        } else if (game.awayScore > game.homeScore) {
            result = 2; // Away wins
        }

        return ResolutionData({
            result: result,
            resolved: true,
            timestamp: block.timestamp,
            proof: abi.encode(game),
            metadata: string(abi.encodePacked("Sports result: ", game.homeTeam, " vs ", game.awayTeam))
        });
    }

    function _resolveCustomPrediction(
        bytes32 questionId,
        bytes memory data
    ) internal view returns (ResolutionData memory) {
        bytes32 requestId = abi.decode(data, (bytes32));
        CustomRequest memory request = customRequests[requestId];
        
        require(request.fulfilled, "Custom request not fulfilled");

        return ResolutionData({
            result: request.result,
            resolved: true,
            timestamp: block.timestamp,
            proof: abi.encode(request),
            metadata: string(abi.encodePacked("Custom API result from ", request.url))
        });
    }

    // ============ Data Structures ============
    
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint8 decimals;
        uint256 confidence;
        bytes32 feedId;
    }
}

/**
 * @title AggregatorV3Interface
 * @dev Chainlink price feed interface
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    
    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}