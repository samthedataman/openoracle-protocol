// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title OpenOracleRouter
 * @dev Clean, extensible oracle router for the OpenOracle Protocol
 * 
 * This contract provides a unified interface for querying multiple oracle providers
 * with intelligent routing, fallback mechanisms, and cost optimization.
 * 
 * Key Features:
 * - Multi-provider oracle support
 * - AI-powered routing (off-chain)
 * - Automatic failover
 * - Cost optimization
 * - Usage-based fee structure
 * - Extensible adapter system
 */
contract OpenOracleRouter is Ownable, ReentrancyGuard, Pausable {
    
    // ============ Types ============
    
    enum DataType {
        PRICE,
        WEATHER,
        SPORTS,
        CUSTOM,
        NEWS,
        SOCIAL
    }
    
    enum OracleStatus {
        ACTIVE,
        INACTIVE,
        DEPRECATED
    }
    
    struct OracleProvider {
        string name;
        address adapter;
        uint256 fee;                    // Fee in wei per query
        uint256 stakeRequired;          // Minimum stake required
        OracleStatus status;
        uint256 successCount;
        uint256 failureCount;
        uint256 lastResponseTime;
        DataType[] supportedTypes;
    }
    
    struct OracleRequest {
        address requester;
        string query;
        DataType dataType;
        bytes parameters;
        uint256 timestamp;
        uint256 maxFee;                 // Maximum fee willing to pay
        address preferredProvider;      // Optional preferred provider
    }
    
    struct OracleResponse {
        bytes data;
        address provider;
        uint256 timestamp;
        uint256 confidence;             // Confidence score (0-100)
        uint256 cost;
        bool success;
    }
    
    // ============ Storage ============
    
    mapping(address => OracleProvider) public providers;
    mapping(address => uint256) public stakes;              // User stakes for fee discounts
    mapping(address => uint256) public dailyQueries;       // Daily query count per user
    mapping(address => uint256) public lastQueryReset;     // Last daily reset timestamp
    
    address[] public providerAddresses;
    
    // Configuration
    uint256 public constant FREE_QUERIES_PER_DAY = 1000;
    uint256 public baseFee = 0.001 ether;                  // Base fee per query
    uint256 public minimumStake = 100 ether;               // Minimum stake for discounts
    uint256 public maxFeeDiscount = 50;                    // Maximum 50% discount
    
    // Fee collection
    uint256 public totalFeesCollected;
    address public treasuryAddress;
    
    // ============ Events ============
    
    event ProviderRegistered(address indexed provider, string name);
    event ProviderUpdated(address indexed provider, OracleStatus status);
    event OracleQueried(
        address indexed requester,
        address indexed provider,
        string query,
        DataType dataType,
        uint256 fee
    );
    event StakeDeposited(address indexed user, uint256 amount);
    event StakeWithdrawn(address indexed user, uint256 amount);
    event FeesWithdrawn(uint256 amount, address to);
    
    // ============ Modifiers ============
    
    modifier validProvider(address provider) {
        require(
            providers[provider].status == OracleStatus.ACTIVE,
            "Provider not active"
        );
        _;
    }
    
    modifier onlyProvider() {
        require(
            providers[msg.sender].status == OracleStatus.ACTIVE,
            "Not authorized provider"
        );
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _treasuryAddress) {
        treasuryAddress = _treasuryAddress;
    }
    
    // ============ Oracle Provider Management ============
    
    /**
     * @dev Register a new oracle provider
     * @param provider Address of the oracle provider
     * @param name Human-readable name
     * @param fee Fee per query in wei
     * @param supportedTypes Array of supported data types
     */
    function registerProvider(
        address provider,
        string memory name,
        uint256 fee,
        DataType[] memory supportedTypes
    ) external onlyOwner {
        require(provider != address(0), "Invalid provider address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(supportedTypes.length > 0, "Must support at least one data type");
        
        providers[provider] = OracleProvider({
            name: name,
            adapter: provider,
            fee: fee,
            stakeRequired: 0,
            status: OracleStatus.ACTIVE,
            successCount: 0,
            failureCount: 0,
            lastResponseTime: 0,
            supportedTypes: supportedTypes
        });
        
        providerAddresses.push(provider);
        
        emit ProviderRegistered(provider, name);
    }
    
    /**
     * @dev Update oracle provider status
     */
    function updateProviderStatus(
        address provider,
        OracleStatus status
    ) external onlyOwner {
        require(providers[provider].adapter != address(0), "Provider not registered");
        
        providers[provider].status = status;
        emit ProviderUpdated(provider, status);
    }
    
    /**
     * @dev Update oracle provider fee
     */
    function updateProviderFee(
        address provider,
        uint256 newFee
    ) external onlyOwner validProvider(provider) {
        providers[provider].fee = newFee;
    }
    
    // ============ Oracle Queries ============
    
    /**
     * @dev Query oracle with automatic provider selection
     * @param query The query string
     * @param dataType Type of data being requested
     * @param parameters Additional parameters as encoded bytes
     * @return response Oracle response struct
     */
    function queryOracle(
        string memory query,
        DataType dataType,
        bytes memory parameters
    ) external payable nonReentrant whenNotPaused returns (OracleResponse memory) {
        return queryOracleWithProvider(query, dataType, parameters, address(0));
    }
    
    /**
     * @dev Query oracle with preferred provider
     * @param query The query string
     * @param dataType Type of data being requested  
     * @param parameters Additional parameters as encoded bytes
     * @param preferredProvider Preferred oracle provider (address(0) for auto-select)
     * @return response Oracle response struct
     */
    function queryOracleWithProvider(
        string memory query,
        DataType dataType,
        bytes memory parameters,
        address preferredProvider
    ) public payable nonReentrant whenNotPaused returns (OracleResponse memory) {
        require(bytes(query).length > 0, "Query cannot be empty");
        
        // Calculate required fee
        uint256 requiredFee = calculateFee(msg.sender, dataType);
        require(msg.value >= requiredFee, "Insufficient fee");
        
        // Select oracle provider
        address selectedProvider = preferredProvider != address(0) 
            ? preferredProvider 
            : selectBestProvider(dataType);
            
        require(selectedProvider != address(0), "No provider available");
        require(
            providers[selectedProvider].status == OracleStatus.ACTIVE,
            "Selected provider not active"
        );
        
        // Update usage tracking
        updateDailyQueries(msg.sender);
        
        // Execute oracle query
        OracleResponse memory response = executeQuery(
            selectedProvider,
            query,
            dataType,
            parameters,
            requiredFee
        );
        
        // Collect fees
        if (requiredFee > 0) {
            totalFeesCollected += requiredFee;
        }
        
        // Refund excess payment
        if (msg.value > requiredFee) {
            payable(msg.sender).transfer(msg.value - requiredFee);
        }
        
        emit OracleQueried(msg.sender, selectedProvider, query, dataType, requiredFee);
        
        return response;
    }
    
    /**
     * @dev Execute oracle query on selected provider
     */
    function executeQuery(
        address provider,
        string memory query,
        DataType dataType,
        bytes memory parameters,
        uint256 fee
    ) internal returns (OracleResponse memory) {
        uint256 startTime = block.timestamp;
        
        try IOracleAdapter(provider).query(query, uint8(dataType), parameters) 
            returns (bytes memory data, uint256 confidence) {
            
            // Update provider success metrics
            providers[provider].successCount++;
            providers[provider].lastResponseTime = block.timestamp - startTime;
            
            return OracleResponse({
                data: data,
                provider: provider,
                timestamp: block.timestamp,
                confidence: confidence,
                cost: fee,
                success: true
            });
            
        } catch {
            // Update provider failure metrics
            providers[provider].failureCount++;
            
            return OracleResponse({
                data: "",
                provider: provider,
                timestamp: block.timestamp,
                confidence: 0,
                cost: fee,
                success: false
            });
        }
    }
    
    // ============ Provider Selection ============
    
    /**
     * @dev Select best oracle provider for data type
     * Uses success rate, response time, and cost to determine best provider
     */
    function selectBestProvider(DataType dataType) internal view returns (address) {
        address bestProvider = address(0);
        uint256 bestScore = 0;
        
        for (uint256 i = 0; i < providerAddresses.length; i++) {
            address provider = providerAddresses[i];
            OracleProvider storage providerData = providers[provider];
            
            if (providerData.status != OracleStatus.ACTIVE) continue;
            if (!supportsDataType(provider, dataType)) continue;
            
            uint256 score = calculateProviderScore(provider);
            if (score > bestScore) {
                bestScore = score;
                bestProvider = provider;
            }
        }
        
        return bestProvider;
    }
    
    /**
     * @dev Calculate provider performance score
     */
    function calculateProviderScore(address provider) internal view returns (uint256) {
        OracleProvider storage providerData = providers[provider];
        
        uint256 totalQueries = providerData.successCount + providerData.failureCount;
        if (totalQueries == 0) return 50; // Neutral score for new providers
        
        // Success rate (0-100)
        uint256 successRate = (providerData.successCount * 100) / totalQueries;
        
        // Response time score (inverse relationship)
        uint256 responseScore = providerData.lastResponseTime > 0 
            ? 100 - (providerData.lastResponseTime > 100 ? 100 : providerData.lastResponseTime)
            : 50;
        
        // Combined score (weighted)
        return (successRate * 70 + responseScore * 30) / 100;
    }
    
    /**
     * @dev Check if provider supports data type
     */
    function supportsDataType(address provider, DataType dataType) internal view returns (bool) {
        DataType[] storage supportedTypes = providers[provider].supportedTypes;
        
        for (uint256 i = 0; i < supportedTypes.length; i++) {
            if (supportedTypes[i] == dataType) return true;
        }
        
        return false;
    }
    
    // ============ Fee Management ============
    
    /**
     * @dev Calculate fee for user based on usage and stake
     */
    function calculateFee(address user, DataType dataType) public view returns (uint256) {
        // Check free tier
        if (getDailyQueries(user) < FREE_QUERIES_PER_DAY) {
            return 0;
        }
        
        // Calculate base fee
        uint256 fee = baseFee;
        
        // Apply stake discount
        uint256 stakeDiscount = calculateStakeDiscount(user);
        fee = fee * (100 - stakeDiscount) / 100;
        
        return fee;
    }
    
    /**
     * @dev Calculate stake-based fee discount
     */
    function calculateStakeDiscount(address user) public view returns (uint256) {
        uint256 userStake = stakes[user];
        if (userStake < minimumStake) return 0;
        
        // Linear discount up to maximum
        uint256 discount = (userStake * maxFeeDiscount) / (minimumStake * 10);
        return discount > maxFeeDiscount ? maxFeeDiscount : discount;
    }
    
    /**
     * @dev Get daily query count for user
     */
    function getDailyQueries(address user) public view returns (uint256) {
        if (block.timestamp - lastQueryReset[user] >= 24 hours) {
            return 0; // Reset daily count
        }
        return dailyQueries[user];
    }
    
    /**
     * @dev Update daily query tracking
     */
    function updateDailyQueries(address user) internal {
        if (block.timestamp - lastQueryReset[user] >= 24 hours) {
            dailyQueries[user] = 1;
            lastQueryReset[user] = block.timestamp;
        } else {
            dailyQueries[user]++;
        }
    }
    
    // ============ Staking ============
    
    /**
     * @dev Deposit stake for fee discounts
     */
    function depositStake() external payable {
        require(msg.value > 0, "Must deposit positive amount");
        
        stakes[msg.sender] += msg.value;
        emit StakeDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw stake
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        require(stakes[msg.sender] >= amount, "Insufficient stake");
        
        stakes[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        
        emit StakeWithdrawn(msg.sender, amount);
    }
    
    // ============ Fee Collection ============
    
    /**
     * @dev Withdraw collected fees to treasury
     */
    function withdrawFees() external onlyOwner {
        require(totalFeesCollected > 0, "No fees to withdraw");
        
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        
        payable(treasuryAddress).transfer(amount);
        emit FeesWithdrawn(amount, treasuryAddress);
    }
    
    /**
     * @dev Update treasury address
     */
    function setTreasuryAddress(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        treasuryAddress = newTreasury;
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get all active providers
     */
    function getActiveProviders() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active providers
        for (uint256 i = 0; i < providerAddresses.length; i++) {
            if (providers[providerAddresses[i]].status == OracleStatus.ACTIVE) {
                activeCount++;
            }
        }
        
        // Build active providers array
        address[] memory activeProviders = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < providerAddresses.length; i++) {
            if (providers[providerAddresses[i]].status == OracleStatus.ACTIVE) {
                activeProviders[index] = providerAddresses[i];
                index++;
            }
        }
        
        return activeProviders;
    }
    
    /**
     * @dev Get provider performance stats
     */
    function getProviderStats(address provider) external view returns (
        uint256 successCount,
        uint256 failureCount,
        uint256 successRate,
        uint256 lastResponseTime
    ) {
        OracleProvider storage providerData = providers[provider];
        
        successCount = providerData.successCount;
        failureCount = providerData.failureCount;
        
        uint256 totalQueries = successCount + failureCount;
        successRate = totalQueries > 0 ? (successCount * 100) / totalQueries : 0;
        lastResponseTime = providerData.lastResponseTime;
    }
    
    // ============ Admin Functions ============
    
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
    
    /**
     * @dev Emergency withdrawal function
     */
    function emergencyWithdraw() external onlyOwner whenPaused {
        payable(owner()).transfer(address(this).balance);
    }
}

/**
 * @title IOracleAdapter
 * @dev Interface that all oracle adapters must implement
 */
interface IOracleAdapter {
    /**
     * @dev Execute oracle query
     * @param query The query string
     * @param dataType Type of data (as uint8)
     * @param parameters Additional parameters
     * @return data Response data as bytes
     * @return confidence Confidence score (0-100)
     */
    function query(
        string memory query,
        uint8 dataType,
        bytes memory parameters
    ) external returns (bytes memory data, uint256 confidence);
}