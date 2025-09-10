// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./OracleRouter.sol";

/**
 * @title TruthMarket
 * @dev Individual prediction market with oracle integration and time-weighted betting
 * @notice Optimized for Base L2 with automatic oracle resolution
 */
contract TruthMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant PLATFORM_FEE_RATE = 250; // 2.5% scaled by 1e4
    uint256 public constant MAX_TIME_MULTIPLIER = 300; // 3x multiplier for early bets
    uint256 public constant MIN_TIME_MULTIPLIER = 100; // 1x multiplier for late bets
    uint256 public constant DISPUTE_PERIOD = 24 hours;
    uint256 public constant MIN_BET_AMOUNT = 1e15; // 0.001 tokens minimum

    // ============ Enums ============
    enum MarketStatus {
        ACTIVE,
        ENDED,
        RESOLVED,
        DISPUTED,
        CANCELLED
    }

    // ============ State Variables ============
    uint256 public immutable marketId;
    string public question;
    string[] public outcomes;
    address public immutable creator;
    address public immutable factory;
    
    uint256 public immutable endTime;
    uint256 public resolveTime;
    uint256 public disputeDeadline;
    
    address public immutable paymentToken; // address(0) for ETH
    bytes32 public immutable oracleDataType;
    address public immutable assignedOracle;
    bytes public oracleParams;
    
    MarketStatus public status;
    uint8 public winningOutcome;
    bool public disputed;
    
    // Betting pools
    mapping(uint8 => uint256) public outcomePools; // outcome => total pool
    mapping(address => mapping(uint8 => Position[])) public userPositions;
    mapping(address => uint256) public userTotalBets;
    mapping(uint8 => address[]) public outcomeParticipants;
    
    uint256 public totalPool;
    uint256 public totalBets;
    uint256 public platformFees;
    uint256 public oracleFees;
    
    // Time-weighted multipliers
    mapping(address => mapping(uint8 => uint256)) public userMultipliers;

    // ============ Events ============
    event BetPlaced(
        address indexed user,
        uint8 indexed outcome,
        uint256 amount,
        uint256 multiplier,
        uint256 timestamp
    );
    
    event MarketResolved(
        uint8 indexed winningOutcome,
        uint256 totalPayout,
        uint256 timestamp
    );
    
    event WinningsClaimed(
        address indexed user,
        uint256 amount,
        uint8 outcome
    );
    
    event MarketDisputed(
        address indexed disputer,
        string reason,
        uint256 timestamp
    );
    
    event DisputeResolved(
        bool upheld,
        uint8 newOutcome,
        uint256 timestamp
    );

    // ============ Modifiers ============
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier marketActive() {
        require(status == MarketStatus.ACTIVE && block.timestamp < endTime, "Market not active");
        _;
    }

    modifier marketEnded() {
        require(block.timestamp >= endTime || status == MarketStatus.ENDED, "Market not ended");
        _;
    }

    modifier marketResolved() {
        require(status == MarketStatus.RESOLVED, "Market not resolved");
        _;
    }

    modifier validOutcome(uint8 outcome) {
        require(outcome < outcomes.length, "Invalid outcome");
        _;
    }

    // ============ Constructor ============
    constructor(
        uint256 _marketId,
        string memory _question,
        string[] memory _outcomes,
        address _creator,
        uint256 _endTime,
        address _paymentToken,
        bytes32 _oracleDataType,
        address _assignedOracle,
        bytes memory _oracleParams,
        address _factory
    ) {
        marketId = _marketId;
        question = _question;
        outcomes = _outcomes;
        creator = _creator;
        endTime = _endTime;
        paymentToken = _paymentToken;
        oracleDataType = _oracleDataType;
        assignedOracle = _assignedOracle;
        oracleParams = _oracleParams;
        factory = _factory;
        
        status = MarketStatus.ACTIVE;
    }

    // ============ Betting Functions ============

    /**
     * @dev Places a bet on a specific outcome with time-weighted multiplier
     * @param outcome The outcome to bet on
     * @param amount The amount to bet
     */
    function placeBet(uint8 outcome, uint256 amount) 
        external 
        payable 
        marketActive 
        validOutcome(outcome) 
        nonReentrant 
    {
        require(amount >= MIN_BET_AMOUNT, "Bet too small");
        
        // Handle payment
        if (paymentToken == address(0)) {
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            require(msg.value == 0, "No ETH needed for token bets");
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Calculate time-weighted multiplier
        uint256 multiplier = _calculateTimeMultiplier();
        
        // Calculate fees
        uint256 platformFee = (amount * PLATFORM_FEE_RATE) / 10000;
        uint256 oracleFee = _estimateOracleFee(amount);
        uint256 netAmount = amount - platformFee - oracleFee;
        
        // Update pools
        outcomePools[outcome] += netAmount;
        totalPool += netAmount;
        totalBets++;
        platformFees += platformFee;
        oracleFees += oracleFee;
        
        // Record user position
        userPositions[msg.sender][outcome].push(Position({
            amount: netAmount,
            multiplier: multiplier,
            timestamp: block.timestamp
        }));
        
        userTotalBets[msg.sender] += amount;
        
        // Track participants
        if (userPositions[msg.sender][outcome].length == 1) {
            outcomeParticipants[outcome].push(msg.sender);
        }

        emit BetPlaced(msg.sender, outcome, netAmount, multiplier, block.timestamp);
    }

    /**
     * @dev Places multiple bets in a single transaction
     * @param outcomes Array of outcomes to bet on
     * @param amounts Array of amounts to bet
     */
    function batchPlaceBets(uint8[] calldata outcomes, uint256[] calldata amounts) 
        external 
        payable 
        marketActive 
        nonReentrant 
    {
        require(outcomes.length == amounts.length && outcomes.length > 0, "Invalid arrays");
        require(outcomes.length <= 10, "Too many bets");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        if (paymentToken == address(0)) {
            require(msg.value == totalAmount, "Incorrect total ETH");
        } else {
            require(msg.value == 0, "No ETH needed");
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), totalAmount);
        }
        
        for (uint256 i = 0; i < outcomes.length; i++) {
            _placeBetInternal(outcomes[i], amounts[i]);
        }
    }

    // ============ Resolution Functions ============

    /**
     * @dev Resolves the market using oracle data
     * @return The winning outcome
     */
    function resolveMarket() external marketEnded onlyFactory returns (uint8) {
        require(status == MarketStatus.ACTIVE || status == MarketStatus.ENDED, "Invalid status");
        
        // Get resolution from oracle
        IOracle.ResolutionData memory resolution = IOracle(assignedOracle).resolvePrediction(
            keccak256(abi.encodePacked(marketId, question)),
            oracleParams
        );
        
        require(resolution.resolved, "Oracle resolution failed");
        require(resolution.result < outcomes.length, "Invalid oracle result");
        
        winningOutcome = uint8(resolution.result);
        resolveTime = block.timestamp;
        disputeDeadline = block.timestamp + DISPUTE_PERIOD;
        status = MarketStatus.RESOLVED;
        
        emit MarketResolved(winningOutcome, totalPool, block.timestamp);
        
        return winningOutcome;
    }

    /**
     * @dev Disputes the market resolution
     * @param reason Reason for dispute
     */
    function disputeResolution(string calldata reason) external payable {
        require(status == MarketStatus.RESOLVED, "Market not resolved");
        require(block.timestamp <= disputeDeadline, "Dispute period ended");
        require(!disputed, "Already disputed");
        require(userTotalBets[msg.sender] > 0, "Must have bet to dispute");
        
        // Require dispute fee (prevents spam)
        uint256 disputeFee = totalPool / 100; // 1% of total pool
        if (paymentToken == address(0)) {
            require(msg.value >= disputeFee, "Insufficient dispute fee");
        } else {
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), disputeFee);
        }
        
        disputed = true;
        status = MarketStatus.DISPUTED;
        disputeDeadline = block.timestamp + DISPUTE_PERIOD;
        
        emit MarketDisputed(msg.sender, reason, block.timestamp);
    }

    /**
     * @dev Resolves a disputed market (admin function via factory)
     */
    function resolveDispute(bool upheld, uint8 newOutcome) external onlyFactory {
        require(status == MarketStatus.DISPUTED, "Not disputed");
        require(newOutcome < outcomes.length, "Invalid outcome");
        
        if (upheld) {
            // Dispute upheld - change outcome
            winningOutcome = newOutcome;
            status = MarketStatus.RESOLVED;
        } else {
            // Dispute rejected - keep original outcome
            status = MarketStatus.RESOLVED;
        }
        
        disputeDeadline = 0;
        disputed = false;
        
        emit DisputeResolved(upheld, newOutcome, block.timestamp);
    }

    // ============ Claiming Functions ============

    /**
     * @dev Claims winnings for resolved market
     * @return totalWinnings The total amount claimed
     */
    function claimWinnings() external marketResolved nonReentrant returns (uint256 totalWinnings) {
        require(!disputed || block.timestamp > disputeDeadline, "Dispute period active");
        
        Position[] storage positions = userPositions[msg.sender][winningOutcome];
        require(positions.length > 0, "No winning positions");
        
        uint256 winningPool = outcomePools[winningOutcome];
        require(winningPool > 0, "No winning pool");
        
        // Calculate total winnings with time multipliers
        for (uint256 i = 0; i < positions.length; i++) {
            Position storage pos = positions[i];
            if (pos.amount > 0) {
                // Base payout + multiplier bonus
                uint256 basePayout = (pos.amount * totalPool) / winningPool;
                uint256 multiplierBonus = (basePayout * (pos.multiplier - 100)) / 100;
                uint256 positionWinnings = basePayout + multiplierBonus;
                
                totalWinnings += positionWinnings;
                pos.amount = 0; // Prevent double claiming
            }
        }
        
        require(totalWinnings > 0, "No winnings to claim");
        
        // Transfer winnings
        if (paymentToken == address(0)) {
            (bool success, ) = msg.sender.call{value: totalWinnings}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(paymentToken).safeTransfer(msg.sender, totalWinnings);
        }
        
        emit WinningsClaimed(msg.sender, totalWinnings, winningOutcome);
    }

    /**
     * @dev Claims winnings for multiple users (gas optimization)
     */
    function batchClaimWinnings(address[] calldata users) external {
        require(status == MarketStatus.RESOLVED, "Market not resolved");
        require(!disputed || block.timestamp > disputeDeadline, "Dispute period active");
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            if (userPositions[user][winningOutcome].length > 0) {
                _claimWinningsFor(user);
            }
        }
    }

    // ============ Emergency Functions ============

    /**
     * @dev Emergency deactivation (factory only)
     */
    function emergencyDeactivate() external onlyFactory {
        status = MarketStatus.CANCELLED;
    }

    /**
     * @dev Refunds bets in case of cancellation
     */
    function claimRefund() external nonReentrant {
        require(status == MarketStatus.CANCELLED, "Market not cancelled");
        
        uint256 refundAmount = 0;
        
        // Calculate refund across all outcomes
        for (uint8 i = 0; i < outcomes.length; i++) {
            Position[] storage positions = userPositions[msg.sender][i];
            for (uint256 j = 0; j < positions.length; j++) {
                refundAmount += positions[j].amount;
                positions[j].amount = 0;
            }
        }
        
        require(refundAmount > 0, "No refund available");
        
        // Transfer refund
        if (paymentToken == address(0)) {
            (bool success, ) = msg.sender.call{value: refundAmount}("");
            require(success, "ETH refund failed");
        } else {
            IERC20(paymentToken).safeTransfer(msg.sender, refundAmount);
        }
    }

    // ============ View Functions ============

    /**
     * @dev Gets market information
     */
    function getMarketInfo() external view returns (Market memory) {
        return Market({
            marketId: marketId,
            question: question,
            creator: creator,
            endTime: endTime,
            status: status,
            totalPool: totalPool,
            paymentToken: paymentToken,
            oracleDataType: oracleDataType,
            assignedOracle: assignedOracle
        });
    }

    /**
     * @dev Gets user positions for all outcomes
     */
    function getUserPositions(address user) external view returns (UserPositionData[] memory) {
        UserPositionData[] memory userData = new UserPositionData[](outcomes.length);
        
        for (uint8 i = 0; i < outcomes.length; i++) {
            Position[] memory positions = userPositions[user][i];
            uint256 totalAmount = 0;
            uint256 totalMultiplier = 0;
            
            for (uint256 j = 0; j < positions.length; j++) {
                totalAmount += positions[j].amount;
                totalMultiplier += positions[j].multiplier * positions[j].amount;
            }
            
            userData[i] = UserPositionData({
                outcome: i,
                totalAmount: totalAmount,
                avgMultiplier: totalAmount > 0 ? totalMultiplier / totalAmount : 0,
                positionCount: positions.length
            });
        }
        
        return userData;
    }

    /**
     * @dev Gets potential winnings for user
     */
    function getPotentialWinnings(address user, uint8 outcome) external view returns (uint256) {
        if (outcomePools[outcome] == 0) return 0;
        
        uint256 totalAmount = 0;
        uint256 totalWinnings = 0;
        Position[] memory positions = userPositions[user][outcome];
        
        for (uint256 i = 0; i < positions.length; i++) {
            uint256 basePayout = (positions[i].amount * totalPool) / outcomePools[outcome];
            uint256 multiplierBonus = (basePayout * (positions[i].multiplier - 100)) / 100;
            totalWinnings += basePayout + multiplierBonus;
        }
        
        return totalWinnings;
    }

    /**
     * @dev Checks if market can be resolved
     */
    function canResolve() external view returns (bool) {
        return block.timestamp >= endTime && 
               (status == MarketStatus.ACTIVE || status == MarketStatus.ENDED);
    }

    /**
     * @dev Checks if market is active
     */
    function isActive() external view returns (bool) {
        return status == MarketStatus.ACTIVE && block.timestamp < endTime;
    }

    /**
     * @dev Gets total number of bets
     */
    function getTotalBets() external view returns (uint256) {
        return totalBets;
    }

    /**
     * @dev Gets total payout amount
     */
    function getTotalPayout() external view returns (uint256) {
        return totalPool + platformFees + oracleFees;
    }

    // ============ Internal Functions ============

    function _placeBetInternal(uint8 outcome, uint256 amount) internal validOutcome(outcome) {
        require(amount >= MIN_BET_AMOUNT, "Bet too small");
        
        uint256 multiplier = _calculateTimeMultiplier();
        
        uint256 platformFee = (amount * PLATFORM_FEE_RATE) / 10000;
        uint256 oracleFee = _estimateOracleFee(amount);
        uint256 netAmount = amount - platformFee - oracleFee;
        
        outcomePools[outcome] += netAmount;
        totalPool += netAmount;
        totalBets++;
        platformFees += platformFee;
        oracleFees += oracleFee;
        
        userPositions[msg.sender][outcome].push(Position({
            amount: netAmount,
            multiplier: multiplier,
            timestamp: block.timestamp
        }));
        
        userTotalBets[msg.sender] += amount;
        
        if (userPositions[msg.sender][outcome].length == 1) {
            outcomeParticipants[outcome].push(msg.sender);
        }

        emit BetPlaced(msg.sender, outcome, netAmount, multiplier, block.timestamp);
    }

    function _calculateTimeMultiplier() internal view returns (uint256) {
        if (block.timestamp >= endTime) return MIN_TIME_MULTIPLIER;
        
        uint256 marketDuration = endTime - (endTime - block.timestamp);
        uint256 timeRemaining = endTime - block.timestamp;
        
        // Linear decay from MAX_TIME_MULTIPLIER to MIN_TIME_MULTIPLIER
        uint256 multiplier = MIN_TIME_MULTIPLIER + 
            ((MAX_TIME_MULTIPLIER - MIN_TIME_MULTIPLIER) * timeRemaining) / marketDuration;
        
        return multiplier;
    }

    function _estimateOracleFee(uint256 betAmount) internal view returns (uint256) {
        // Estimate 0.5% for oracle fees (can be dynamic based on oracle)
        return (betAmount * 50) / 10000;
    }

    function _claimWinningsFor(address user) internal {
        Position[] storage positions = userPositions[user][winningOutcome];
        if (positions.length == 0) return;
        
        uint256 winningPool = outcomePools[winningOutcome];
        if (winningPool == 0) return;
        
        uint256 totalWinnings = 0;
        
        for (uint256 i = 0; i < positions.length; i++) {
            Position storage pos = positions[i];
            if (pos.amount > 0) {
                uint256 basePayout = (pos.amount * totalPool) / winningPool;
                uint256 multiplierBonus = (basePayout * (pos.multiplier - 100)) / 100;
                uint256 positionWinnings = basePayout + multiplierBonus;
                
                totalWinnings += positionWinnings;
                pos.amount = 0;
            }
        }
        
        if (totalWinnings > 0) {
            if (paymentToken == address(0)) {
                (bool success, ) = user.call{value: totalWinnings}("");
                require(success, "ETH transfer failed");
            } else {
                IERC20(paymentToken).safeTransfer(user, totalWinnings);
            }
            
            emit WinningsClaimed(user, totalWinnings, winningOutcome);
        }
    }

    // ============ Data Structures ============

    struct Position {
        uint256 amount;
        uint256 multiplier;
        uint256 timestamp;
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
    }

    struct UserPositionData {
        uint8 outcome;
        uint256 totalAmount;
        uint256 avgMultiplier;
        uint256 positionCount;
    }
}