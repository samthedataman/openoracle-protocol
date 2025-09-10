// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./TruthMarket.sol";
import "./OracleRouter.sol";

/**
 * @title PredictionMarketFactory
 * @dev Factory contract for creating prediction markets on Base L2
 * @notice Optimized for Base L2's low gas costs and high throughput
 */
contract PredictionMarketFactory is Ownable, ReentrancyGuard {
    using Create2 for bytes32;

    // ============ Constants ============
    uint256 public constant PLATFORM_FEE_RATE = 250; // 2.5% scaled by 1e4
    uint256 public constant MIN_MARKET_DURATION = 1 hours;
    uint256 public constant MAX_MARKET_DURATION = 365 days;
    uint256 public constant MIN_INITIAL_LIQUIDITY = 1e18; // 1 token minimum
    uint256 public constant MAX_OUTCOMES = 10;

    // ============ State Variables ============
    OracleRouter public immutable oracleRouter;
    
    uint256 public marketCounter;
    uint256 public totalMarketsCreated;
    uint256 public totalVolumeTraded;
    
    mapping(uint256 => address) public markets;
    mapping(address => bool) public isValidMarket;
    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => address) public marketByHash; // For deterministic addresses
    
    address public feeRecipient;
    bool public paused;

    // ============ Events ============
    event MarketCreated(
        uint256 indexed marketId,
        address indexed marketAddress,
        address indexed creator,
        string question,
        uint256 endTime,
        address paymentToken,
        bytes32 oracleDataType
    );
    
    event MarketResolved(
        uint256 indexed marketId,
        address indexed marketAddress,
        uint8 winningOutcome,
        uint256 totalPayout
    );
    
    event TokenSupportUpdated(address indexed token, bool supported);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event PausedStateChanged(bool paused);

    // ============ Modifiers ============
    modifier whenNotPaused() {
        require(!paused, "Factory paused");
        _;
    }

    modifier validToken(address token) {
        require(supportedTokens[token], "Token not supported");
        _;
    }

    modifier validMarket(address market) {
        require(isValidMarket[market], "Invalid market");
        _;
    }

    // ============ Constructor ============
    constructor(address _oracleRouter, address _feeRecipient) {
        require(_oracleRouter != address(0), "Invalid oracle router");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        oracleRouter = OracleRouter(_oracleRouter);
        feeRecipient = _feeRecipient;
        
        // Support common Base L2 tokens
        supportedTokens[0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA] = true; // USDbC
        supportedTokens[0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913] = true; // USDC
        supportedTokens[0x4200000000000000000000000000000000000006] = true; // WETH
        supportedTokens[address(0)] = true; // Native ETH
    }

    // ============ Market Creation ============

    /**
     * @dev Creates a new prediction market with oracle integration
     * @param question The prediction question
     * @param outcomes Array of possible outcomes
     * @param duration Market duration in seconds
     * @param paymentToken Token used for betting (address(0) for ETH)
     * @param oracleDataType Type of oracle data needed
     * @param oracleParams Additional parameters for oracle resolution
     * @param salt Salt for deterministic address generation
     * @return marketId The ID of the created market
     * @return marketAddress The address of the created market
     */
    function createMarket(
        string calldata question,
        string[] calldata outcomes,
        uint256 duration,
        address paymentToken,
        bytes32 oracleDataType,
        bytes calldata oracleParams,
        bytes32 salt
    ) external payable whenNotPaused validToken(paymentToken) nonReentrant returns (uint256 marketId, address marketAddress) {
        require(bytes(question).length > 0, "Empty question");
        require(outcomes.length >= 2 && outcomes.length <= MAX_OUTCOMES, "Invalid outcomes count");
        require(duration >= MIN_MARKET_DURATION && duration <= MAX_MARKET_DURATION, "Invalid duration");
        
        // Route question to find optimal oracle
        IOracleRouter.RouteResult memory routeResult = oracleRouter.routeQuestion(
            question,
            oracleDataType,
            type(uint256).max
        );
        
        require(routeResult.success, "No suitable oracle found");

        marketId = ++marketCounter;
        uint256 endTime = block.timestamp + duration;

        // Generate deterministic address
        bytes32 marketSalt = keccak256(abi.encodePacked(
            msg.sender,
            question,
            oracleDataType,
            endTime,
            salt
        ));

        // Deploy market contract using CREATE2
        bytes memory bytecode = abi.encodePacked(
            type(TruthMarket).creationCode,
            abi.encode(
                marketId,
                question,
                outcomes,
                msg.sender,
                endTime,
                paymentToken,
                oracleDataType,
                routeResult.oracleAddress,
                oracleParams,
                address(this)
            )
        );

        marketAddress = Create2.deploy(0, marketSalt, bytecode);

        // Store market information
        markets[marketId] = marketAddress;
        isValidMarket[marketAddress] = true;
        marketByHash[marketSalt] = marketAddress;

        totalMarketsCreated++;

        emit MarketCreated(
            marketId,
            marketAddress,
            msg.sender,
            question,
            endTime,
            paymentToken,
            oracleDataType
        );
    }

    /**
     * @dev Batch creates multiple prediction markets
     * @param requests Array of market creation requests
     * @return marketIds Array of created market IDs
     * @return marketAddresses Array of created market addresses
     */
    function batchCreateMarkets(
        MarketRequest[] calldata requests
    ) external payable whenNotPaused nonReentrant returns (uint256[] memory marketIds, address[] memory marketAddresses) {
        require(requests.length > 0 && requests.length <= 10, "Invalid batch size");
        
        marketIds = new uint256[](requests.length);
        marketAddresses = new address[](requests.length);

        for (uint256 i = 0; i < requests.length; i++) {
            (marketIds[i], marketAddresses[i]) = createMarket(
                requests[i].question,
                requests[i].outcomes,
                requests[i].duration,
                requests[i].paymentToken,
                requests[i].oracleDataType,
                requests[i].oracleParams,
                requests[i].salt
            );
        }
    }

    // ============ Market Resolution ============

    /**
     * @dev Resolves a market using oracle data
     * @param marketId The market ID to resolve
     */
    function resolveMarket(uint256 marketId) external whenNotPaused validMarket(markets[marketId]) {
        address marketAddress = markets[marketId];
        TruthMarket market = TruthMarket(marketAddress);
        
        require(market.canResolve(), "Market not ready for resolution");
        
        uint8 winningOutcome = market.resolveMarket();
        uint256 totalPayout = market.getTotalPayout();
        
        totalVolumeTraded += totalPayout;
        
        emit MarketResolved(marketId, marketAddress, winningOutcome, totalPayout);
    }

    /**
     * @dev Batch resolves multiple markets
     * @param marketIds Array of market IDs to resolve
     */
    function batchResolveMarkets(uint256[] calldata marketIds) external whenNotPaused {
        for (uint256 i = 0; i < marketIds.length; i++) {
            if (isValidMarket[markets[marketIds[i]]]) {
                try this.resolveMarket(marketIds[i]) {
                    // Market resolved successfully
                } catch {
                    // Skip failed resolutions
                    continue;
                }
            }
        }
    }

    // ============ View Functions ============

    /**
     * @dev Gets market information
     * @param marketId The market ID
     * @return market The market struct
     */
    function getMarket(uint256 marketId) external view returns (TruthMarket.Market memory market) {
        address marketAddress = markets[marketId];
        require(marketAddress != address(0), "Market not found");
        
        return TruthMarket(marketAddress).getMarketInfo();
    }

    /**
     * @dev Gets multiple markets information
     * @param startId Starting market ID
     * @param count Number of markets to fetch
     * @return marketData Array of market information
     */
    function getMarkets(uint256 startId, uint256 count) external view returns (MarketData[] memory marketData) {
        require(count > 0 && count <= 100, "Invalid count");
        
        marketData = new MarketData[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 marketId = startId + i;
            address marketAddress = markets[marketId];
            
            if (marketAddress != address(0)) {
                TruthMarket market = TruthMarket(marketAddress);
                marketData[i] = MarketData({
                    marketId: marketId,
                    marketAddress: marketAddress,
                    market: market.getMarketInfo(),
                    totalBets: market.getTotalBets(),
                    isActive: market.isActive()
                });
            }
        }
    }

    /**
     * @dev Gets factory statistics
     */
    function getFactoryStats() external view returns (
        uint256 totalMarkets,
        uint256 activeMarkets,
        uint256 totalVolume,
        uint256 platformFeeRate
    ) {
        return (
            totalMarketsCreated,
            _countActiveMarkets(),
            totalVolumeTraded,
            PLATFORM_FEE_RATE
        );
    }

    /**
     * @dev Predicts market address for given parameters
     * @param creator The market creator
     * @param question The prediction question
     * @param oracleDataType Type of oracle data
     * @param endTime Market end time
     * @param salt User-provided salt
     * @return predictedAddress The predicted market address
     */
    function predictMarketAddress(
        address creator,
        string calldata question,
        bytes32 oracleDataType,
        uint256 endTime,
        bytes32 salt
    ) external view returns (address predictedAddress) {
        bytes32 marketSalt = keccak256(abi.encodePacked(
            creator,
            question,
            oracleDataType,
            endTime,
            salt
        ));

        return Create2.computeAddress(marketSalt, keccak256(type(TruthMarket).creationCode));
    }

    // ============ Admin Functions ============

    /**
     * @dev Updates token support status
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    /**
     * @dev Updates fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /**
     * @dev Pauses/unpauses the factory
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedStateChanged(_paused);
    }

    /**
     * @dev Emergency market deactivation
     */
    function emergencyDeactivateMarket(address marketAddress) external onlyOwner validMarket(marketAddress) {
        TruthMarket(marketAddress).emergencyDeactivate();
    }

    // ============ Internal Functions ============

    function _countActiveMarkets() internal view returns (uint256 count) {
        for (uint256 i = 1; i <= marketCounter; i++) {
            address marketAddress = markets[i];
            if (marketAddress != address(0) && TruthMarket(marketAddress).isActive()) {
                count++;
            }
        }
    }

    // ============ Data Structures ============

    struct MarketRequest {
        string question;
        string[] outcomes;
        uint256 duration;
        address paymentToken;
        bytes32 oracleDataType;
        bytes oracleParams;
        bytes32 salt;
    }

    struct MarketData {
        uint256 marketId;
        address marketAddress;
        TruthMarket.Market market;
        uint256 totalBets;
        bool isActive;
    }
}