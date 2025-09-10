// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PolyPoll for Base Ethereum
 * @dev Prediction markets on Base L2 with ETH, USDC, PYUSD, and cbETH support
 * @notice Optimized for Base Ethereum with Coinbase ecosystem integration
 * @author PolyPoll Foundation
 * @custom:network Base Ethereum L2
 * @custom:version 2.0-BASE
 */
contract PolyPoll is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    uint256 public constant MIN_POLL_DURATION = 24 hours;
    uint256 public constant MAX_POLL_DURATION = 96 hours;
    uint256 public constant MAX_DAILY_POLLS = 10;
    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    uint256 public constant MAX_OPTIONS = 5;
    uint256 public constant MIN_OPTIONS = 2;
    
    // Time multipliers (in basis points, 10000 = 1x)
    uint256 public constant EARLY_BIRD_BONUS = 15000; // 1.5x for first 10%
    uint256 public constant QUICK_BONUS = 13000;      // 1.3x for next 20%
    uint256 public constant NORMAL_BONUS = 11000;     // 1.1x for next 30%
    uint256 public constant BASE_MULTIPLIER = 10000;  // 1.0x for remainder
    
    // ============ Base Ethereum Token Addresses ============
    // BASE MAINNET (Chain ID: 8453)
    address public constant NATIVE_ETH = address(0); // ETH
    address public constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant PYUSD_BASE = 0xcAa940d48B22b8F3fb53b7d5Eb0a0E43bC261d3C;
    address public constant CBETH_BASE = 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22; // Coinbase Wrapped Staked ETH
    address public constant WETH_BASE = 0x4200000000000000000000000000000000000006; // Wrapped ETH on Base
    
    // BASE SEPOLIA TESTNET (Chain ID: 84532) - For Testing
    // Update these with testnet addresses when deploying to testnet
    
    // ============ Token Configuration ============
    struct TokenConfig {
        bool isAccepted;
        uint256 minBet;      // Minimum bet in token decimals
        uint256 maxBet;      // Maximum bet in token decimals
        uint8 decimals;      // Token decimals for display
        string symbol;       // Token symbol for UI
        uint256 totalVolume; // Track total volume per token
    }
    
    // ============ Poll Structure ============
    struct Poll {
        string articleUrl;
        string question;
        string[] options;
        address paymentToken;     // Which token this poll accepts
        uint256 startTime;
        uint256 endTime;
        uint256 duration;         // Flexible duration (24-96 hours)
        uint256 totalPool;
        uint256 earlyBirdCutoff;
        uint256 quickCutoff;
        uint256 normalCutoff;
        bool resolved;
        uint8 winningOption;
        bool wasCancelled;        // Track if poll was cancelled
        bool wasRefunded;         // Track if single participant refund
        address creator;
        uint256 creatorReward;    // Optional: reward poll creators
        mapping(uint8 => uint256) optionPools;
        mapping(uint8 => uint256) weightedOptionPools;
        mapping(address => UserBet) userBets;
        mapping(address => bool) hasClaimed;
        address[] participants;
    }
    
    struct UserBet {
        uint8 option;
        uint256 amount;
        uint256 weightedAmount;
        uint256 timestamp;
        bool hasVoted;
    }
    
    struct PollView {
        uint256 pollId;
        string articleUrl;
        string question;
        string[] options;
        address paymentToken;
        string tokenSymbol;
        uint256 startTime;
        uint256 endTime;
        uint256 duration;
        uint256 totalPool;
        uint256[] optionPools;
        uint256[] optionPercentages;
        bool resolved;
        bool wasCancelled;
        bool wasRefunded;
        uint8 winningOption;
        uint256 participantCount;
        bool hasUserVoted;
        uint8 userOption;
        uint256 userAmount;
        address creator;
    }
    
    // ============ State Variables ============
    mapping(uint256 => Poll) public polls;
    mapping(address => TokenConfig) public acceptedTokens;
    mapping(string => uint256[]) public articlePolls;
    mapping(uint256 => uint8) public dailyPollCount;
    mapping(address => uint256) public collectedFees;
    mapping(address => uint256) public userTotalBets;
    mapping(address => uint256) public userTotalWinnings;
    mapping(address => uint256[]) public userPolls;
    
    address public feeRecipient;
    uint256 public nextPollId = 1;
    uint256 public minParticipants = 2; // Configurable minimum participants
    uint256 public totalPollsCreated;
    uint256 public totalBetsPlaced;
    uint256 public totalVolumeProcessed;
    
    // ============ Events ============
    event PollCreated(
        uint256 indexed pollId,
        string articleUrl,
        address indexed paymentToken,
        uint256 duration,
        address indexed creator
    );
    
    event BetPlaced(
        uint256 indexed pollId,
        address indexed user,
        uint8 option,
        uint256 amount,
        uint256 weightedAmount,
        address token
    );
    
    event PollResolved(
        uint256 indexed pollId,
        uint8 winningOption,
        uint256 totalPool,
        uint256 platformFee,
        address token
    );
    
    event PollCancelled(
        uint256 indexed pollId,
        string reason
    );
    
    event PollRefunded(
        uint256 indexed pollId,
        address indexed participant,
        uint256 amount,
        address token
    );
    
    event WinningsClaimed(
        uint256 indexed pollId,
        address indexed user,
        uint256 amount,
        address token
    );
    
    event TieResolved(
        uint256 indexed pollId,
        uint8[] tiedOptions,
        uint8 selectedWinner,
        string method
    );
    
    event EmergencyWithdrawal(
        address indexed token,
        uint256 amount,
        address indexed recipient
    );
    
    event MinParticipantsUpdated(uint256 oldValue, uint256 newValue);
    event TokenConfigUpdated(address indexed token, string symbol);
    
    // ============ Constructor ============
    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        
        // Configure ETH (native token on Base)
        acceptedTokens[NATIVE_ETH] = TokenConfig({
            isAccepted: true,
            minBet: 0.0001 ether,  // 0.0001 ETH (~$0.40 at $4000/ETH)
            maxBet: 0.1 ether,      // 0.1 ETH (~$400 at $4000/ETH)
            decimals: 18,
            symbol: "ETH",
            totalVolume: 0
        });
        
        // Configure USDC on Base
        acceptedTokens[USDC_BASE] = TokenConfig({
            isAccepted: true,
            minBet: 1e6,        // 1 USDC
            maxBet: 10000e6,    // 10,000 USDC
            decimals: 6,
            symbol: "USDC",
            totalVolume: 0
        });
        
        // Configure PYUSD on Base
        acceptedTokens[PYUSD_BASE] = TokenConfig({
            isAccepted: true,
            minBet: 1e6,        // 1 PYUSD
            maxBet: 10000e6,    // 10,000 PYUSD
            decimals: 6,
            symbol: "PYUSD",
            totalVolume: 0
        });
        
        // Configure cbETH (Coinbase Staked ETH) on Base
        acceptedTokens[CBETH_BASE] = TokenConfig({
            isAccepted: true,
            minBet: 0.0001 ether,  // 0.0001 cbETH
            maxBet: 0.1 ether,      // 0.1 cbETH
            decimals: 18,
            symbol: "cbETH",
            totalVolume: 0
        });
    }
    
    // ============ Poll Creation ============
    
    /**
     * @dev Create a poll with flexible duration (24-96 hours)
     * @param _articleUrl URL of the article
     * @param _question Poll question
     * @param _options Array of options (2-5)
     * @param _paymentToken Address of payment token (address(0) for ETH)
     * @param _durationHours Duration in hours (24-96)
     */
    function createPoll(
        string memory _articleUrl,
        string memory _question,
        string[] memory _options,
        address _paymentToken,
        uint256 _durationHours
    ) external whenNotPaused returns (uint256) {
        // Validate inputs
        require(acceptedTokens[_paymentToken].isAccepted, "Token not accepted");
        require(bytes(_articleUrl).length > 0 && bytes(_articleUrl).length <= 500, "Invalid URL length");
        require(bytes(_question).length > 0 && bytes(_question).length <= 280, "Invalid question length");
        require(_options.length >= MIN_OPTIONS && _options.length <= MAX_OPTIONS, "2-5 options required");
        
        // Validate duration (24-96 hours)
        uint256 duration = _durationHours * 1 hours;
        require(duration >= MIN_POLL_DURATION && duration <= MAX_POLL_DURATION, "Duration must be 24-96 hours");
        
        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        require(dailyPollCount[today] < MAX_DAILY_POLLS, "Daily limit reached");
        
        // Validate all options are non-empty and reasonable length
        for (uint256 i = 0; i < _options.length; i++) {
            require(bytes(_options[i]).length > 0 && bytes(_options[i]).length <= 100, "Invalid option length");
        }
        
        uint256 pollId = nextPollId++;
        Poll storage poll = polls[pollId];
        
        poll.articleUrl = _articleUrl;
        poll.question = _question;
        poll.options = _options;
        poll.paymentToken = _paymentToken;
        poll.startTime = block.timestamp;
        poll.endTime = block.timestamp + duration;
        poll.duration = duration;
        poll.creator = msg.sender;
        
        // Set time bonus cutoffs based on actual duration
        poll.earlyBirdCutoff = block.timestamp + (duration * 10 / 100);  // 10% of duration
        poll.quickCutoff = block.timestamp + (duration * 30 / 100);      // 30% of duration
        poll.normalCutoff = block.timestamp + (duration * 60 / 100);     // 60% of duration
        
        articlePolls[_articleUrl].push(pollId);
        dailyPollCount[today]++;
        totalPollsCreated++;
        userPolls[msg.sender].push(pollId);
        
        emit PollCreated(
            pollId,
            _articleUrl,
            _paymentToken,
            duration,
            msg.sender
        );
        
        return pollId;
    }
    
    // ============ Betting Functions ============
    
    /**
     * @dev Place a bet with native ETH
     */
    function placeBetETH(uint256 _pollId, uint8 _option) 
        external 
        payable 
        nonReentrant
        whenNotPaused
    {
        Poll storage poll = polls[_pollId];
        require(poll.startTime > 0, "Poll does not exist");
        require(poll.paymentToken == NATIVE_ETH, "Poll requires different token");
        require(!poll.resolved, "Poll already resolved");
        require(block.timestamp < poll.endTime, "Poll ended");
        require(_option < poll.options.length, "Invalid option");
        require(!poll.userBets[msg.sender].hasVoted, "Already voted");
        
        TokenConfig storage config = acceptedTokens[NATIVE_ETH];
        require(msg.value >= config.minBet && msg.value <= config.maxBet, "Invalid amount");
        
        _recordBet(poll, _pollId, msg.sender, _option, msg.value);
        config.totalVolume += msg.value;
    }
    
    /**
     * @dev Place a bet with ERC20 token (USDC, PYUSD, cbETH)
     */
    function placeBetToken(
        uint256 _pollId,
        uint8 _option,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        Poll storage poll = polls[_pollId];
        require(poll.startTime > 0, "Poll does not exist");
        require(poll.paymentToken != NATIVE_ETH, "Use placeBetETH for ETH");
        require(!poll.resolved, "Poll already resolved");
        require(block.timestamp < poll.endTime, "Poll ended");
        require(_option < poll.options.length, "Invalid option");
        require(!poll.userBets[msg.sender].hasVoted, "Already voted");
        
        TokenConfig storage config = acceptedTokens[poll.paymentToken];
        require(config.isAccepted, "Token not accepted");
        require(_amount >= config.minBet && _amount <= config.maxBet, "Invalid amount");
        
        // Transfer tokens from user
        IERC20(poll.paymentToken).safeTransferFrom(msg.sender, address(this), _amount);
        
        _recordBet(poll, _pollId, msg.sender, _option, _amount);
        config.totalVolume += _amount;
    }
    
    /**
     * @dev Internal function to record a bet
     */
    function _recordBet(
        Poll storage poll,
        uint256 pollId,
        address user,
        uint8 option,
        uint256 amount
    ) internal {
        // Calculate time bonus
        uint256 multiplier = getTimeMultiplier(poll);
        uint256 weightedAmount = (amount * multiplier) / BASE_MULTIPLIER;
        
        // Record bet
        poll.userBets[user] = UserBet({
            option: option,
            amount: amount,
            weightedAmount: weightedAmount,
            timestamp: block.timestamp,
            hasVoted: true
        });
        
        // Update pools
        poll.totalPool += amount;
        poll.optionPools[option] += amount;
        poll.weightedOptionPools[option] += weightedAmount;
        poll.participants.push(user);
        
        // Update user stats
        userTotalBets[user] += amount;
        userPolls[user].push(pollId);
        totalBetsPlaced++;
        totalVolumeProcessed += amount;
        
        emit BetPlaced(pollId, user, option, amount, weightedAmount, poll.paymentToken);
    }
    
    // ============ Resolution Functions with Complete Logic ============
    
    /**
     * @dev Resolve a poll with complete edge case handling
     */
    function resolvePoll(uint256 _pollId) external nonReentrant {
        Poll storage poll = polls[_pollId];
        require(poll.startTime > 0, "Poll does not exist");
        require(block.timestamp >= poll.endTime, "Poll not ended");
        require(!poll.resolved, "Already resolved");
        
        poll.resolved = true;
        
        // CASE 1: No participants - cancel poll
        if (poll.participants.length == 0) {
            poll.wasCancelled = true;
            emit PollCancelled(_pollId, "No participants");
            return;
        }
        
        // CASE 2: Single participant - full refund without fee
        if (poll.participants.length == 1) {
            address soleParticipant = poll.participants[0];
            uint256 refundAmount = poll.userBets[soleParticipant].amount;
            poll.wasRefunded = true;
            
            // Process refund
            if (poll.paymentToken == NATIVE_ETH) {
                (bool success, ) = soleParticipant.call{value: refundAmount}("");
                require(success, "ETH refund failed");
            } else {
                IERC20(poll.paymentToken).safeTransfer(soleParticipant, refundAmount);
            }
            
            emit PollRefunded(_pollId, soleParticipant, refundAmount, poll.paymentToken);
            return;
        }
        
        // CASE 3: Below minimum participants threshold
        if (poll.participants.length < minParticipants && minParticipants > 0) {
            poll.wasCancelled = true;
            // Refund all participants without fee
            for (uint256 i = 0; i < poll.participants.length; i++) {
                address participant = poll.participants[i];
                uint256 refundAmount = poll.userBets[participant].amount;
                poll.hasClaimed[participant] = true;
                
                if (poll.paymentToken == NATIVE_ETH) {
                    (bool success, ) = participant.call{value: refundAmount}("");
                    require(success, "ETH refund failed");
                } else {
                    IERC20(poll.paymentToken).safeTransfer(participant, refundAmount);
                }
                
                emit PollRefunded(_pollId, participant, refundAmount, poll.paymentToken);
            }
            emit PollCancelled(_pollId, "Below minimum participants");
            return;
        }
        
        // CASE 4: Normal resolution - find winner(s)
        uint8[] memory tiedOptions = new uint8[](poll.options.length);
        uint8 tieCount = 0;
        uint256 highestPool = 0;
        
        // First pass: find highest pool amount
        for (uint8 i = 0; i < poll.options.length; i++) {
            if (poll.optionPools[i] > highestPool) {
                highestPool = poll.optionPools[i];
            }
        }
        
        // Second pass: collect all options with highest amount (handle ties)
        for (uint8 i = 0; i < poll.options.length; i++) {
            if (poll.optionPools[i] == highestPool && highestPool > 0) {
                tiedOptions[tieCount++] = i;
            }
        }
        
        // Handle tie resolution
        if (tieCount > 1) {
            // Use block hash as pseudo-randomness for tie breaking
            uint256 randomSeed = uint256(keccak256(abi.encodePacked(
                blockhash(block.number - 1),
                _pollId,
                block.timestamp,
                msg.sender
            )));
            uint8 selectedIndex = uint8(randomSeed % tieCount);
            poll.winningOption = tiedOptions[selectedIndex];
            
            // Emit tie resolution event
            uint8[] memory actualTiedOptions = new uint8[](tieCount);
            for (uint8 i = 0; i < tieCount; i++) {
                actualTiedOptions[i] = tiedOptions[i];
            }
            emit TieResolved(_pollId, actualTiedOptions, poll.winningOption, "Random selection");
        } else if (tieCount == 1) {
            poll.winningOption = tiedOptions[0];
        } else {
            // No votes on any option (shouldn't happen but handle it)
            poll.winningOption = 0;
            poll.wasCancelled = true;
            emit PollCancelled(_pollId, "No votes on any option");
            return;
        }
        
        // Calculate and collect platform fee
        uint256 platformFee = (poll.totalPool * PLATFORM_FEE_BPS) / 10000;
        collectedFees[poll.paymentToken] += platformFee;
        
        // Optional: Give small reward to poll creator (0.5% of pool)
        uint256 creatorReward = (poll.totalPool * 50) / 10000; // 0.5%
        poll.creatorReward = creatorReward;
        collectedFees[poll.paymentToken] += creatorReward;
        
        emit PollResolved(_pollId, poll.winningOption, poll.totalPool, platformFee, poll.paymentToken);
    }
    
    // ============ Claiming Functions ============
    
    /**
     * @dev Claim winnings with division by zero protection
     */
    function claimWinnings(uint256 _pollId) external nonReentrant returns (uint256) {
        Poll storage poll = polls[_pollId];
        require(poll.resolved, "Not resolved");
        require(poll.userBets[msg.sender].hasVoted, "No bet placed");
        require(!poll.hasClaimed[msg.sender], "Already claimed");
        
        poll.hasClaimed[msg.sender] = true;
        UserBet memory bet = poll.userBets[msg.sender];
        
        // Handle cancelled/refunded polls
        if (poll.wasCancelled || poll.wasRefunded) {
            return 0;
        }
        
        // Check if user won
        if (bet.option == poll.winningOption) {
            // Protect against division by zero
            uint256 winningPoolWeight = poll.weightedOptionPools[poll.winningOption];
            require(winningPoolWeight > 0, "Invalid winning pool weight");
            
            // Calculate winnings (deduct platform fee and creator reward)
            uint256 platformFee = (poll.totalPool * PLATFORM_FEE_BPS) / 10000;
            uint256 creatorReward = (poll.totalPool * 50) / 10000; // 0.5%
            uint256 distributablePool = poll.totalPool - platformFee - creatorReward;
            
            uint256 winnings = (distributablePool * bet.weightedAmount) / winningPoolWeight;
            
            // Sanity check: winnings should not exceed distributable pool
            require(winnings <= distributablePool, "Calculation error");
            
            // Update user stats
            userTotalWinnings[msg.sender] += winnings;
            
            // Transfer winnings
            if (poll.paymentToken == NATIVE_ETH) {
                (bool success, ) = msg.sender.call{value: winnings}("");
                require(success, "ETH transfer failed");
            } else {
                IERC20(poll.paymentToken).safeTransfer(msg.sender, winnings);
            }
            
            emit WinningsClaimed(_pollId, msg.sender, winnings, poll.paymentToken);
            return winnings;
        }
        
        return 0;
    }
    
    /**
     * @dev Poll creator claims their reward
     */
    function claimCreatorReward(uint256 _pollId) external nonReentrant {
        Poll storage poll = polls[_pollId];
        require(poll.resolved && !poll.wasCancelled && !poll.wasRefunded, "Not eligible");
        require(poll.creator == msg.sender, "Not poll creator");
        require(poll.creatorReward > 0, "No reward");
        
        uint256 reward = poll.creatorReward;
        poll.creatorReward = 0;
        
        if (poll.paymentToken == NATIVE_ETH) {
            (bool success, ) = msg.sender.call{value: reward}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(poll.paymentToken).safeTransfer(msg.sender, reward);
        }
    }
    
    /**
     * @dev Batch claim from multiple polls
     */
    function batchClaim(uint256[] calldata _pollIds) external nonReentrant returns (uint256 totalClaimed) {
        for (uint256 i = 0; i < _pollIds.length; i++) {
            Poll storage poll = polls[_pollIds[i]];
            
            // Skip if not eligible
            if (!poll.resolved || 
                !poll.userBets[msg.sender].hasVoted || 
                poll.hasClaimed[msg.sender] ||
                poll.wasCancelled ||
                poll.wasRefunded) {
                continue;
            }
            
            UserBet memory bet = poll.userBets[msg.sender];
            
            if (bet.option == poll.winningOption) {
                poll.hasClaimed[msg.sender] = true;
                
                uint256 winningPoolWeight = poll.weightedOptionPools[poll.winningOption];
                if (winningPoolWeight == 0) continue;
                
                uint256 platformFee = (poll.totalPool * PLATFORM_FEE_BPS) / 10000;
                uint256 creatorReward = (poll.totalPool * 50) / 10000;
                uint256 distributablePool = poll.totalPool - platformFee - creatorReward;
                uint256 winnings = (distributablePool * bet.weightedAmount) / winningPoolWeight;
                
                if (winnings > distributablePool) continue;
                
                userTotalWinnings[msg.sender] += winnings;
                totalClaimed += winnings;
                
                if (poll.paymentToken == NATIVE_ETH) {
                    (bool success, ) = msg.sender.call{value: winnings}("");
                    if (success) {
                        emit WinningsClaimed(_pollIds[i], msg.sender, winnings, poll.paymentToken);
                    }
                } else {
                    IERC20(poll.paymentToken).safeTransfer(msg.sender, winnings);
                    emit WinningsClaimed(_pollIds[i], msg.sender, winnings, poll.paymentToken);
                }
            }
        }
        
        return totalClaimed;
    }
    
    // ============ View Functions ============
    
    function getTimeMultiplier(Poll storage poll) internal view returns (uint256) {
        if (block.timestamp <= poll.earlyBirdCutoff) return EARLY_BIRD_BONUS;
        if (block.timestamp <= poll.quickCutoff) return QUICK_BONUS;
        if (block.timestamp <= poll.normalCutoff) return NORMAL_BONUS;
        return BASE_MULTIPLIER;
    }
    
    function getCurrentMultiplier(uint256 _pollId) external view returns (uint256) {
        return getTimeMultiplier(polls[_pollId]);
    }
    
    function getPollDetails(uint256 _pollId, address _user) external view returns (PollView memory) {
        Poll storage poll = polls[_pollId];
        PollView memory pollView;
        
        pollView.pollId = _pollId;
        pollView.articleUrl = poll.articleUrl;
        pollView.question = poll.question;
        pollView.options = poll.options;
        pollView.paymentToken = poll.paymentToken;
        pollView.tokenSymbol = acceptedTokens[poll.paymentToken].symbol;
        pollView.startTime = poll.startTime;
        pollView.endTime = poll.endTime;
        pollView.duration = poll.duration;
        pollView.totalPool = poll.totalPool;
        pollView.resolved = poll.resolved;
        pollView.wasCancelled = poll.wasCancelled;
        pollView.wasRefunded = poll.wasRefunded;
        pollView.winningOption = poll.winningOption;
        pollView.participantCount = poll.participants.length;
        pollView.creator = poll.creator;
        
        // Calculate pools and percentages
        pollView.optionPools = new uint256[](poll.options.length);
        pollView.optionPercentages = new uint256[](poll.options.length);
        
        for (uint8 i = 0; i < poll.options.length; i++) {
            pollView.optionPools[i] = poll.optionPools[i];
            if (poll.totalPool > 0) {
                pollView.optionPercentages[i] = (poll.optionPools[i] * 10000) / poll.totalPool;
            }
        }
        
        // User specific data
        if (poll.userBets[_user].hasVoted) {
            pollView.hasUserVoted = true;
            pollView.userOption = poll.userBets[_user].option;
            pollView.userAmount = poll.userBets[_user].amount;
        }
        
        return pollView;
    }
    
    function getUserStats(address _user) external view returns (
        uint256 totalBets,
        uint256 totalWinnings,
        uint256 totalPolls,
        uint256[] memory userPollIds
    ) {
        return (
            userTotalBets[_user],
            userTotalWinnings[_user],
            userPolls[_user].length,
            userPolls[_user]
        );
    }
    
    function getProtocolStats() external view returns (
        uint256 totalPolls,
        uint256 totalBets,
        uint256 totalVolume,
        uint256 activePollsCount
    ) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i < nextPollId; i++) {
            if (!polls[i].resolved && block.timestamp < polls[i].endTime) {
                activeCount++;
            }
        }
        
        return (
            totalPollsCreated,
            totalBetsPlaced,
            totalVolumeProcessed,
            activeCount
        );
    }
    
    function getTokenVolume(address _token) external view returns (uint256) {
        return acceptedTokens[_token].totalVolume;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Set minimum participants threshold
     */
    function setMinParticipants(uint256 _minParticipants) external onlyOwner {
        require(_minParticipants <= 10, "Too high");
        uint256 oldValue = minParticipants;
        minParticipants = _minParticipants;
        emit MinParticipantsUpdated(oldValue, _minParticipants);
    }
    
    /**
     * @dev Add a new accepted token
     */
    function addToken(
        address _token,
        string memory _symbol,
        uint8 _decimals,
        uint256 _minBet,
        uint256 _maxBet
    ) external onlyOwner {
        require(!acceptedTokens[_token].isAccepted, "Already added");
        require(_minBet > 0 && _maxBet > _minBet, "Invalid bet limits");
        
        acceptedTokens[_token] = TokenConfig({
            isAccepted: true,
            minBet: _minBet,
            maxBet: _maxBet,
            decimals: _decimals,
            symbol: _symbol,
            totalVolume: 0
        });
        
        emit TokenConfigUpdated(_token, _symbol);
    }
    
    /**
     * @dev Withdraw collected fees
     */
    function withdrawFees(address _token) external onlyOwner nonReentrant {
        uint256 amount = collectedFees[_token];
        require(amount > 0, "No fees");
        
        collectedFees[_token] = 0;
        
        if (_token == NATIVE_ETH) {
            (bool success, ) = feeRecipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(_token).safeTransfer(feeRecipient, amount);
        }
    }
    
    /**
     * @dev Emergency withdrawal for stuck funds
     */
    function emergencyWithdraw(
        address _token,
        uint256 _amount,
        address _recipient
    ) external onlyOwner nonReentrant {
        require(_recipient != address(0), "Invalid recipient");
        
        if (_token == NATIVE_ETH) {
            require(address(this).balance >= _amount, "Insufficient ETH balance");
            (bool success, ) = _recipient.call{value: _amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(_token).safeTransfer(_recipient, _amount);
        }
        
        emit EmergencyWithdrawal(_token, _amount, _recipient);
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Receive/Fallback ============
    receive() external payable {
        revert("Use placeBetETH function");
    }
    
    fallback() external payable {
        revert("Function does not exist");
    }
}