// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title UMAAdapter
 * @dev UMA Optimistic Oracle adapter for Base L2
 * @notice Handles subjective events and disputes through UMA's optimistic oracle system
 */
contract UMAAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant LIVENESS_PERIOD = 2 hours; // Time to dispute assertions
    uint256 public constant MIN_BOND_AMOUNT = 1e18; // Minimum bond for assertions
    uint256 public constant DISPUTE_BOND_MULTIPLIER = 2; // 2x the assertion bond
    uint256 public constant BASE_COST = 0.01 ether; // Higher cost for subjective resolution
    
    // Base L2 UMA contract addresses
    address public constant OPTIMISTIC_ORACLE_V3 = 0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB;
    address public constant DEFAULT_CURRENCY = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // USDC on Base
    
    // ============ Data Types ============
    bytes32 public constant SUBJECTIVE_DATA = keccak256("SUBJECTIVE_DATA");
    bytes32 public constant ELECTION_DATA = keccak256("ELECTION_DATA");
    bytes32 public constant EVENT_DATA = keccak256("EVENT_DATA");
    bytes32 public constant CUSTOM_DATA = keccak256("CUSTOM_DATA");

    // ============ State Variables ============
    mapping(bytes32 => Assertion) public assertions;
    mapping(bytes32 => bool) public supportedDataTypes;
    mapping(address => bool) public authorizedAsserters;
    mapping(bytes32 => bytes32) public questionToAssertionId;
    mapping(bytes32 => DisputeInfo) public disputes;
    
    uint256 public totalAssertions;
    uint256 public successfulResolutions;
    uint256 public totalDisputes;
    uint256 public averageResolutionTime;
    
    address public defaultCurrency;
    uint256 public defaultBondAmount;
    uint256 public defaultLiveness;

    // ============ Structs ============
    struct Assertion {
        bytes32 assertionId;
        bytes32 questionId;
        address asserter;
        string claim;
        bytes32 domainId;
        address currency;
        uint256 bond;
        uint256 assertionTime;
        uint256 expirationTime;
        bool resolved;
        bool disputed;
        uint256 resolvedValue;
        bytes proof;
    }

    struct DisputeInfo {
        bytes32 assertionId;
        address disputer;
        uint256 disputeTime;
        uint256 disputeBond;
        bool resolved;
        bool disputeUpheld;
        string reason;
    }

    struct QuestionTemplate {
        string template;
        string description;
        bytes32 dataType;
        uint256 minBond;
        uint256 liveness;
        bool requiresWhitelist;
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
    event AssertionMade(
        bytes32 indexed assertionId,
        bytes32 indexed questionId,
        address indexed asserter,
        string claim,
        uint256 bond,
        uint256 expirationTime
    );
    
    event AssertionResolved(
        bytes32 indexed assertionId,
        bytes32 indexed questionId,
        uint256 resolvedValue,
        bool disputed
    );
    
    event AssertionDisputed(
        bytes32 indexed assertionId,
        address indexed disputer,
        uint256 disputeBond,
        string reason
    );
    
    event QuestionTemplateAdded(
        bytes32 indexed templateId,
        string template,
        bytes32 dataType
    );

    event AuthorizedAsserterUpdated(address indexed asserter, bool authorized);

    // ============ Modifiers ============
    modifier onlyAuthorizedAsserter() {
        require(authorizedAsserters[msg.sender] || msg.sender == owner(), "Not authorized asserter");
        _;
    }

    modifier validDataType(bytes32 dataType) {
        require(supportedDataTypes[dataType], "Unsupported data type");
        _;
    }

    modifier validAssertion(bytes32 assertionId) {
        require(assertions[assertionId].assertionId != bytes32(0), "Assertion not found");
        _;
    }

    // ============ Constructor ============
    constructor() {
        // Initialize supported data types
        supportedDataTypes[SUBJECTIVE_DATA] = true;
        supportedDataTypes[ELECTION_DATA] = true;
        supportedDataTypes[EVENT_DATA] = true;
        supportedDataTypes[CUSTOM_DATA] = true;

        // Set default parameters
        defaultCurrency = DEFAULT_CURRENCY;
        defaultBondAmount = MIN_BOND_AMOUNT;
        defaultLiveness = LIVENESS_PERIOD;

        // Add owner as authorized asserter
        authorizedAsserters[msg.sender] = true;
    }

    // ============ Core Interface Implementation ============

    /**
     * @dev Returns the oracle provider identifier
     */
    function getProvider() external pure returns (string memory) {
        return "UMA Optimistic Oracle";
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
        bytes32 assertionId = questionToAssertionId[dataId];
        require(assertionId != bytes32(0), "No assertion found for data ID");
        
        Assertion memory assertion = assertions[assertionId];
        require(assertion.resolved, "Assertion not resolved");

        uint256 confidence = _calculateConfidence(assertion);

        return OracleData({
            value: assertion.resolvedValue,
            timestamp: assertion.expirationTime,
            confidence: confidence,
            dataId: dataId,
            source: "UMA Optimistic Oracle"
        });
    }

    /**
     * @dev Makes an assertion for a prediction question
     */
    function makeAssertion(
        bytes32 questionId,
        string calldata claim,
        bytes32 domainId,
        uint256 bondAmount,
        address currency,
        uint256 liveness
    ) external onlyAuthorizedAsserter returns (bytes32 assertionId) {
        require(bytes(claim).length > 0, "Empty claim");
        require(bondAmount >= MIN_BOND_AMOUNT, "Bond too small");
        require(liveness >= LIVENESS_PERIOD, "Liveness too short");

        // Transfer bond from asserter
        if (currency == address(0)) {
            require(msg.value >= bondAmount, "Insufficient ETH bond");
        } else {
            IERC20(currency).safeTransferFrom(msg.sender, address(this), bondAmount);
        }

        // Generate assertion ID
        assertionId = keccak256(abi.encodePacked(
            questionId,
            claim,
            msg.sender,
            block.timestamp,
            totalAssertions
        ));

        // Store assertion
        assertions[assertionId] = Assertion({
            assertionId: assertionId,
            questionId: questionId,
            asserter: msg.sender,
            claim: claim,
            domainId: domainId,
            currency: currency,
            bond: bondAmount,
            assertionTime: block.timestamp,
            expirationTime: block.timestamp + liveness,
            resolved: false,
            disputed: false,
            resolvedValue: 0,
            proof: ""
        });

        questionToAssertionId[questionId] = assertionId;
        totalAssertions++;

        // Make assertion to UMA Optimistic Oracle V3
        _makeUMAAssertion(assertionId, claim, currency, bondAmount, liveness);

        emit AssertionMade(
            assertionId,
            questionId,
            msg.sender,
            claim,
            bondAmount,
            block.timestamp + liveness
        );
    }

    /**
     * @dev Disputes an assertion during the liveness period
     */
    function disputeAssertion(
        bytes32 assertionId,
        string calldata reason
    ) external payable validAssertion(assertionId) {
        Assertion storage assertion = assertions[assertionId];
        require(block.timestamp < assertion.expirationTime, "Liveness period expired");
        require(!assertion.disputed, "Already disputed");
        require(!assertion.resolved, "Already resolved");

        uint256 disputeBond = assertion.bond * DISPUTE_BOND_MULTIPLIER;

        // Transfer dispute bond
        if (assertion.currency == address(0)) {
            require(msg.value >= disputeBond, "Insufficient ETH dispute bond");
        } else {
            IERC20(assertion.currency).safeTransferFrom(msg.sender, address(this), disputeBond);
        }

        // Mark as disputed
        assertion.disputed = true;
        
        disputes[assertionId] = DisputeInfo({
            assertionId: assertionId,
            disputer: msg.sender,
            disputeTime: block.timestamp,
            disputeBond: disputeBond,
            resolved: false,
            disputeUpheld: false,
            reason: reason
        });

        totalDisputes++;

        emit AssertionDisputed(assertionId, msg.sender, disputeBond, reason);
    }

    /**
     * @dev Settles an assertion after the liveness period
     */
    function settleAssertion(bytes32 assertionId) external validAssertion(assertionId) {
        Assertion storage assertion = assertions[assertionId];
        require(block.timestamp >= assertion.expirationTime, "Liveness period not expired");
        require(!assertion.resolved, "Already resolved");

        // If disputed, resolution depends on UMA's dispute resolution
        if (assertion.disputed) {
            _settleDisputedAssertion(assertionId);
        } else {
            // No dispute - assertion is true
            assertion.resolved = true;
            assertion.resolvedValue = 1; // True
            successfulResolutions++;
            
            // Return bond to asserter
            _returnBond(assertion.asserter, assertion.currency, assertion.bond);
        }

        emit AssertionResolved(
            assertionId,
            assertion.questionId,
            assertion.resolvedValue,
            assertion.disputed
        );
    }

    /**
     * @dev Resolves a prediction market question using UMA data
     */
    function resolvePrediction(
        bytes32 questionId,
        bytes calldata params
    ) external returns (ResolutionData memory) {
        bytes32 assertionId = questionToAssertionId[questionId];
        require(assertionId != bytes32(0), "No assertion found");
        
        Assertion memory assertion = assertions[assertionId];
        require(assertion.resolved, "Assertion not resolved");

        return ResolutionData({
            result: assertion.resolvedValue,
            resolved: true,
            timestamp: assertion.expirationTime,
            proof: assertion.proof,
            metadata: string(abi.encodePacked("UMA assertion: ", assertion.claim))
        });
    }

    /**
     * @dev Estimates the cost for oracle query in wei
     */
    function estimateCost(bytes32 dataType, bytes calldata params) external view returns (uint256) {
        if (dataType == SUBJECTIVE_DATA || dataType == EVENT_DATA) {
            return BASE_COST; // Base cost for subjective data
        } else if (dataType == ELECTION_DATA) {
            return BASE_COST * 2; // Higher cost for election data
        } else if (dataType == CUSTOM_DATA) {
            return BASE_COST * 3; // Highest cost for custom subjective data
        } else {
            return BASE_COST;
        }
    }

    // ============ Assertion Management ============

    /**
     * @dev Batch settles multiple assertions
     */
    function batchSettleAssertions(bytes32[] calldata assertionIds) external {
        for (uint256 i = 0; i < assertionIds.length; i++) {
            bytes32 assertionId = assertionIds[i];
            Assertion storage assertion = assertions[assertionId];
            
            if (!assertion.resolved && 
                block.timestamp >= assertion.expirationTime &&
                assertion.assertionId != bytes32(0)) {
                
                try this.settleAssertion(assertionId) {
                    // Assertion settled successfully
                } catch {
                    // Skip failed settlements
                    continue;
                }
            }
        }
    }

    /**
     * @dev Creates a question template for standardized assertions
     */
    function addQuestionTemplate(
        bytes32 templateId,
        string calldata template,
        string calldata description,
        bytes32 dataType,
        uint256 minBond,
        uint256 liveness,
        bool requiresWhitelist
    ) external onlyOwner validDataType(dataType) {
        require(bytes(template).length > 0, "Empty template");
        require(minBond >= MIN_BOND_AMOUNT, "Bond too small");

        // Store template (in a real implementation, we'd have a mapping)
        emit QuestionTemplateAdded(templateId, template, dataType);
    }

    // ============ Authorization Management ============

    /**
     * @dev Updates authorized asserter status
     */
    function setAuthorizedAsserter(address asserter, bool authorized) external onlyOwner {
        authorizedAsserters[asserter] = authorized;
        emit AuthorizedAsserterUpdated(asserter, authorized);
    }

    /**
     * @dev Updates default parameters
     */
    function updateDefaultParameters(
        address newDefaultCurrency,
        uint256 newDefaultBond,
        uint256 newDefaultLiveness
    ) external onlyOwner {
        require(newDefaultCurrency != address(0), "Invalid currency");
        require(newDefaultBond >= MIN_BOND_AMOUNT, "Bond too small");
        require(newDefaultLiveness >= LIVENESS_PERIOD, "Liveness too short");

        defaultCurrency = newDefaultCurrency;
        defaultBondAmount = newDefaultBond;
        defaultLiveness = newDefaultLiveness;
    }

    // ============ View Functions ============

    /**
     * @dev Gets assertion information
     */
    function getAssertion(bytes32 assertionId) external view returns (Assertion memory) {
        return assertions[assertionId];
    }

    /**
     * @dev Gets dispute information
     */
    function getDispute(bytes32 assertionId) external view returns (DisputeInfo memory) {
        return disputes[assertionId];
    }

    /**
     * @dev Gets all assertions for a question
     */
    function getQuestionAssertion(bytes32 questionId) external view returns (bytes32) {
        return questionToAssertionId[questionId];
    }

    /**
     * @dev Gets adapter statistics
     */
    function getAdapterStats() external view returns (
        uint256 totalAssertions_,
        uint256 successfulResolutions_,
        uint256 totalDisputes_,
        uint256 disputeRate,
        uint256 avgResolutionTime
    ) {
        totalAssertions_ = totalAssertions;
        successfulResolutions_ = successfulResolutions;
        totalDisputes_ = totalDisputes;
        disputeRate = totalAssertions > 0 ? (totalDisputes * 10000) / totalAssertions : 0;
        avgResolutionTime = averageResolutionTime;
    }

    /**
     * @dev Checks if an assertion can be settled
     */
    function canSettle(bytes32 assertionId) external view returns (bool) {
        Assertion memory assertion = assertions[assertionId];
        return !assertion.resolved && 
               block.timestamp >= assertion.expirationTime &&
               assertion.assertionId != bytes32(0);
    }

    /**
     * @dev Gets pending assertions that can be settled
     */
    function getPendingAssertions() external view returns (bytes32[] memory pendingIds) {
        // In a real implementation, we'd maintain an array of pending assertions
        // For now, this is a placeholder that would return settable assertion IDs
        pendingIds = new bytes32[](0);
    }

    // ============ Internal Functions ============

    function _makeUMAAssertion(
        bytes32 assertionId,
        string memory claim,
        address currency,
        uint256 bondAmount,
        uint256 liveness
    ) internal {
        // In a real implementation, this would interact with UMA's Optimistic Oracle V3
        // For now, we'll just store the assertion data
        // The actual UMA integration would look like:
        // IOptimisticOracleV3(OPTIMISTIC_ORACLE_V3).assertTruth(claim, asserter, callback, currency, bond, identifier, liveness);
    }

    function _settleDisputedAssertion(bytes32 assertionId) internal {
        Assertion storage assertion = assertions[assertionId];
        DisputeInfo storage dispute = disputes[assertionId];
        
        // In a real implementation, we'd check the dispute resolution from UMA
        // For now, we'll simulate a resolution (in practice, this would come from UMA)
        
        // Simulate: 70% chance dispute is rejected (assertion stands)
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.difficulty,
            assertionId
        ))) % 100;
        
        bool disputeUpheld = random < 30; // 30% chance dispute is upheld
        
        dispute.resolved = true;
        dispute.disputeUpheld = disputeUpheld;
        
        if (disputeUpheld) {
            // Dispute upheld - assertion is false
            assertion.resolvedValue = 0;
            assertion.resolved = true;
            
            // Return dispute bond to disputer
            _returnBond(dispute.disputer, assertion.currency, dispute.disputeBond);
            
            // Slash assertion bond (in practice, this goes to UMA)
        } else {
            // Dispute rejected - assertion is true
            assertion.resolvedValue = 1;
            assertion.resolved = true;
            
            // Return assertion bond to asserter
            _returnBond(assertion.asserter, assertion.currency, assertion.bond);
            
            // Slash dispute bond (in practice, this goes to UMA)
        }
        
        successfulResolutions++;
    }

    function _returnBond(address recipient, address currency, uint256 amount) internal {
        if (currency == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(currency).safeTransfer(recipient, amount);
        }
    }

    function _calculateConfidence(Assertion memory assertion) internal view returns (uint256) {
        if (!assertion.resolved) {
            return 0;
        }
        
        uint256 baseConfidence = 9000; // 90% base confidence for UMA
        
        if (assertion.disputed) {
            // Lower confidence for disputed assertions
            baseConfidence = 8500; // 85%
        }
        
        // Increase confidence based on bond amount
        if (assertion.bond > defaultBondAmount * 2) {
            baseConfidence += 500; // +5% for large bonds
        }
        
        // Time factor - more recent resolutions have higher confidence
        uint256 timeSinceResolution = block.timestamp - assertion.expirationTime;
        if (timeSinceResolution > 7 days) {
            baseConfidence -= 1000; // -10% for old resolutions
        }
        
        return baseConfidence > 10000 ? 10000 : baseConfidence;
    }

    // ============ Emergency Functions ============

    /**
     * @dev Emergency withdrawal of stuck funds (owner only)
     */
    function emergencyWithdraw(address currency, uint256 amount) external onlyOwner {
        if (currency == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(currency).safeTransfer(owner(), amount);
        }
    }

    /**
     * @dev Receive ETH for bond payments
     */
    receive() external payable {}
}

/**
 * @title IOptimisticOracleV3
 * @dev Interface for UMA's Optimistic Oracle V3 (placeholder)
 */
interface IOptimisticOracleV3 {
    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address currency,
        uint256 bond,
        bytes32 identifier,
        uint256 liveness
    ) external returns (bytes32 assertionId);
    
    function disputeAssertion(bytes32 assertionId, address disputer) external;
    
    function settleAssertion(bytes32 assertionId) external;
    
    function getAssertion(bytes32 assertionId) external view returns (
        bool resolved,
        bool disputeAllowed,
        uint256 assertionTime,
        address asserter
    );
}