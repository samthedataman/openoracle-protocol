// test/PollyPoll.base.test.js
// Base-specific integration tests for PollyPoll smart contract

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PollyPoll - Base Integration Tests", function () {
  // Base Mainnet Token Addresses
  const BASE_TOKENS = {
    ETH: "0x0000000000000000000000000000000000000000",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    PYUSD: "0xCaA940D48b22B8f3fb53b7d5EB0a0e43Bc261D3c",
    cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    WETH: "0x4200000000000000000000000000000000000006"
  };

  // Time Multipliers (in basis points)
  const MULTIPLIERS = {
    EARLY_BIRD: 15000, // 1.5x
    QUICK: 13000,      // 1.3x
    NORMAL: 11000,     // 1.1x
    BASE: 10000        // 1.0x
  };

  // Constants
  const PLATFORM_FEE_BPS = 250; // 2.5%
  const CREATOR_REWARD_BPS = 50; // 0.5%
  const MIN_POLL_DURATION = 24 * 60 * 60; // 24 hours
  const MAX_POLL_DURATION = 96 * 60 * 60; // 96 hours

  async function deployPollyPollFixture() {
    const [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();
    
    const PollyPoll = await ethers.getContractFactory("PollyPoll");
    const pollyPoll = await PollyPoll.deploy(feeRecipient.address);
    await pollyPoll.deployed();
    
    return { pollyPoll, owner, user1, user2, user3, feeRecipient };
  }

  describe("Base Token Configuration", function () {
    it("Should have correct Base mainnet token addresses configured", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      // Check ETH configuration
      const ethConfig = await pollyPoll.acceptedTokens(BASE_TOKENS.ETH);
      expect(ethConfig.isAccepted).to.be.true;
      expect(ethConfig.symbol).to.equal("ETH");
      expect(ethConfig.decimals).to.equal(18);
      expect(ethConfig.minBet).to.equal(ethers.utils.parseEther("0.0001"));
      expect(ethConfig.maxBet).to.equal(ethers.utils.parseEther("0.1"));
      
      // Check USDC configuration
      const usdcConfig = await pollyPoll.acceptedTokens(BASE_TOKENS.USDC);
      expect(usdcConfig.isAccepted).to.be.true;
      expect(usdcConfig.symbol).to.equal("USDC");
      expect(usdcConfig.decimals).to.equal(6);
      expect(usdcConfig.minBet).to.equal(1000000); // 1 USDC
      expect(usdcConfig.maxBet).to.equal(10000000000); // 10,000 USDC
      
      // Check PYUSD configuration
      const pyusdConfig = await pollyPoll.acceptedTokens(BASE_TOKENS.PYUSD);
      expect(pyusdConfig.isAccepted).to.be.true;
      expect(pyusdConfig.symbol).to.equal("PYUSD");
      expect(pyusdConfig.decimals).to.equal(6);
      
      // Check cbETH configuration
      const cbethConfig = await pollyPoll.acceptedTokens(BASE_TOKENS.cbETH);
      expect(cbethConfig.isAccepted).to.be.true;
      expect(cbethConfig.symbol).to.equal("cbETH");
      expect(cbethConfig.decimals).to.equal(18);
    });
  });

  describe("Poll Creation with Base Tokens", function () {
    it("Should create a poll accepting ETH", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      const tx = await pollyPoll.createPoll(
        "https://base.org/news/article1",
        "Will Base become the leading L2?",
        ["Yes", "No", "Too early to tell"],
        BASE_TOKENS.ETH,
        24 // 24 hours
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "PollCreated");
      
      expect(event.args.pollId).to.equal(1);
      expect(event.args.paymentToken).to.equal(BASE_TOKENS.ETH);
      expect(event.args.duration).to.equal(MIN_POLL_DURATION);
    });

    it("Should create a poll accepting USDC", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      const tx = await pollyPoll.createPoll(
        "https://base.org/news/defi",
        "Will DeFi on Base exceed $10B TVL?",
        ["Yes", "No"],
        BASE_TOKENS.USDC,
        48 // 48 hours
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "PollCreated");
      
      expect(event.args.paymentToken).to.equal(BASE_TOKENS.USDC);
      expect(event.args.duration).to.equal(48 * 60 * 60);
    });

    it("Should create a poll accepting cbETH", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      const tx = await pollyPoll.createPoll(
        "https://coinbase.com/news/staking",
        "Will cbETH market share increase?",
        ["Yes", "No", "Stay the same"],
        BASE_TOKENS.cbETH,
        72 // 72 hours
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "PollCreated");
      
      expect(event.args.paymentToken).to.equal(BASE_TOKENS.cbETH);
    });

    it("Should enforce duration limits (24-96 hours)", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      // Too short (< 24 hours)
      await expect(
        pollyPoll.createPoll(
          "https://url.com",
          "Question?",
          ["Yes", "No"],
          BASE_TOKENS.ETH,
          23 // 23 hours
        )
      ).to.be.revertedWith("Duration must be 24-96 hours");
      
      // Too long (> 96 hours)
      await expect(
        pollyPoll.createPoll(
          "https://url.com",
          "Question?",
          ["Yes", "No"],
          BASE_TOKENS.ETH,
          97 // 97 hours
        )
      ).to.be.revertedWith("Duration must be 24-96 hours");
    });
  });

  describe("Betting with ETH on Base", function () {
    it("Should place ETH bet with low gas cost", async function () {
      const { pollyPoll, user1 } = await loadFixture(deployPollyPollFixture);
      
      // Create poll
      await pollyPoll.createPoll(
        "https://base.org/article",
        "Test question?",
        ["Option A", "Option B"],
        BASE_TOKENS.ETH,
        24
      );
      
      // Place bet and measure gas
      const tx = await pollyPoll.connect(user1).placeBetETH(1, 0, {
        value: ethers.utils.parseEther("0.001")
      });
      
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice;
      const gasCost = gasUsed.mul(gasPrice);
      
      console.log("Gas used for ETH bet:", gasUsed.toString());
      console.log("Gas cost in ETH:", ethers.utils.formatEther(gasCost));
      
      // Check bet was recorded
      const pollDetails = await pollyPoll.getPollDetails(1, user1.address);
      expect(pollDetails.hasUserVoted).to.be.true;
      expect(pollDetails.userAmount).to.equal(ethers.utils.parseEther("0.001"));
    });

    it("Should apply correct time multipliers", async function () {
      const { pollyPoll, user1, user2, user3 } = await loadFixture(deployPollyPollFixture);
      
      // Create 48-hour poll
      await pollyPoll.createPoll(
        "https://base.org/article",
        "Test multipliers?",
        ["Yes", "No"],
        BASE_TOKENS.ETH,
        48
      );
      
      const betAmount = ethers.utils.parseEther("0.01");
      
      // Early bird bet (0-10% of duration = first 4.8 hours)
      await pollyPoll.connect(user1).placeBetETH(1, 0, { value: betAmount });
      let multiplier = await pollyPoll.getCurrentMultiplier(1);
      expect(multiplier).to.equal(MULTIPLIERS.EARLY_BIRD);
      
      // Move to 11% of duration (5.3 hours)
      await time.increase(5.3 * 60 * 60);
      
      // Quick bet (10-30% of duration)
      await pollyPoll.connect(user2).placeBetETH(1, 0, { value: betAmount });
      multiplier = await pollyPoll.getCurrentMultiplier(1);
      expect(multiplier).to.equal(MULTIPLIERS.QUICK);
      
      // Move to 31% of duration (15 hours)
      await time.increase(10 * 60 * 60);
      
      // Normal bet (30-60% of duration)
      await pollyPoll.connect(user3).placeBetETH(1, 1, { value: betAmount });
      multiplier = await pollyPoll.getCurrentMultiplier(1);
      expect(multiplier).to.equal(MULTIPLIERS.NORMAL);
    });
  });

  describe("Poll Resolution and Claiming", function () {
    it("Should resolve poll and distribute winnings correctly", async function () {
      const { pollyPoll, user1, user2, user3, feeRecipient } = await loadFixture(deployPollyPollFixture);
      
      // Create poll
      await pollyPoll.createPoll(
        "https://base.org/article",
        "Which option wins?",
        ["Winner", "Loser"],
        BASE_TOKENS.ETH,
        24
      );
      
      // Place bets
      await pollyPoll.connect(user1).placeBetETH(1, 0, {
        value: ethers.utils.parseEther("0.1") // Bet on Winner
      });
      await pollyPoll.connect(user2).placeBetETH(1, 1, {
        value: ethers.utils.parseEther("0.05") // Bet on Loser
      });
      await pollyPoll.connect(user3).placeBetETH(1, 0, {
        value: ethers.utils.parseEther("0.05") // Bet on Winner
      });
      
      const totalPool = ethers.utils.parseEther("0.2");
      
      // Fast forward to end
      await time.increase(24 * 60 * 60 + 1);
      
      // Resolve poll
      await pollyPoll.resolvePoll(1);
      
      // Check resolution
      const pollDetails = await pollyPoll.getPollDetails(1, ethers.constants.AddressZero);
      expect(pollDetails.resolved).to.be.true;
      expect(pollDetails.winningOption).to.equal(0); // Winner option
      
      // Calculate expected winnings
      const platformFee = totalPool.mul(PLATFORM_FEE_BPS).div(10000);
      const creatorReward = totalPool.mul(CREATOR_REWARD_BPS).div(10000);
      const distributablePool = totalPool.sub(platformFee).sub(creatorReward);
      
      // User1 should get ~66.6% of distributable pool
      const user1BalanceBefore = await user1.getBalance();
      const claimTx1 = await pollyPoll.connect(user1).claimWinnings(1);
      const claimReceipt1 = await claimTx1.wait();
      const user1BalanceAfter = await user1.getBalance();
      
      const user1Winnings = user1BalanceAfter.add(claimReceipt1.gasUsed.mul(claimReceipt1.effectiveGasPrice)).sub(user1BalanceBefore);
      
      // User1 bet 0.1 ETH out of 0.15 ETH total on winning side = 66.6%
      const expectedUser1Share = distributablePool.mul(2).div(3); // Approximately
      expect(user1Winnings).to.be.closeTo(expectedUser1Share, ethers.utils.parseEther("0.01"));
      
      // User2 (loser) should get nothing
      await expect(pollyPoll.connect(user2).claimWinnings(1))
        .to.not.be.reverted;
      
      // Check fees collected
      const collectedFees = await pollyPoll.collectedFees(BASE_TOKENS.ETH);
      expect(collectedFees).to.equal(platformFee.add(creatorReward));
    });

    it("Should handle tie resolution correctly", async function () {
      const { pollyPoll, user1, user2 } = await loadFixture(deployPollyPollFixture);
      
      // Create poll
      await pollyPoll.createPoll(
        "https://base.org/article",
        "Tie test?",
        ["Option A", "Option B"],
        BASE_TOKENS.ETH,
        24
      );
      
      // Place equal bets
      const betAmount = ethers.utils.parseEther("0.05");
      await pollyPoll.connect(user1).placeBetETH(1, 0, { value: betAmount });
      await pollyPoll.connect(user2).placeBetETH(1, 1, { value: betAmount });
      
      // Fast forward and resolve
      await time.increase(24 * 60 * 60 + 1);
      
      const tx = await pollyPoll.resolvePoll(1);
      const receipt = await tx.wait();
      
      // Check for TieResolved event
      const tieEvent = receipt.events.find(e => e.event === "TieResolved");
      expect(tieEvent).to.not.be.undefined;
      expect(tieEvent.args.method).to.equal("Random selection");
      
      // Winner should be either 0 or 1
      const pollDetails = await pollyPoll.getPollDetails(1, ethers.constants.AddressZero);
      expect(pollDetails.winningOption).to.be.oneOf([0, 1]);
    });

    it("Should refund single participant without fees", async function () {
      const { pollyPoll, user1 } = await loadFixture(deployPollyPollFixture);
      
      // Create poll
      await pollyPoll.createPoll(
        "https://base.org/article",
        "Single participant test?",
        ["Yes", "No"],
        BASE_TOKENS.ETH,
        24
      );
      
      // Only one person bets
      const betAmount = ethers.utils.parseEther("0.1");
      await pollyPoll.connect(user1).placeBetETH(1, 0, { value: betAmount });
      
      // Fast forward and resolve
      await time.increase(24 * 60 * 60 + 1);
      
      const user1BalanceBefore = await user1.getBalance();
      
      const tx = await pollyPoll.resolvePoll(1);
      const receipt = await tx.wait();
      
      // Check for refund event
      const refundEvent = receipt.events.find(e => e.event === "PollRefunded");
      expect(refundEvent).to.not.be.undefined;
      expect(refundEvent.args.participant).to.equal(user1.address);
      expect(refundEvent.args.amount).to.equal(betAmount);
      
      // Check poll was marked as refunded
      const pollDetails = await pollyPoll.getPollDetails(1, user1.address);
      expect(pollDetails.wasRefunded).to.be.true;
    });
  });

  describe("Gas Optimization on Base", function () {
    it("Should batch claim multiple polls efficiently", async function () {
      const { pollyPoll, user1, user2 } = await loadFixture(deployPollyPollFixture);
      
      // Create and bet on multiple polls
      const pollIds = [];
      for (let i = 0; i < 3; i++) {
        await pollyPoll.createPoll(
          `https://base.org/article${i}`,
          `Question ${i}?`,
          ["Yes", "No"],
          BASE_TOKENS.ETH,
          24
        );
        
        const pollId = i + 1;
        pollIds.push(pollId);
        
        // User1 bets on winning option
        await pollyPoll.connect(user1).placeBetETH(pollId, 0, {
          value: ethers.utils.parseEther("0.01")
        });
        
        // User2 bets on losing option
        await pollyPoll.connect(user2).placeBetETH(pollId, 1, {
          value: ethers.utils.parseEther("0.005")
        });
      }
      
      // Fast forward and resolve all polls
      await time.increase(24 * 60 * 60 + 1);
      
      for (const pollId of pollIds) {
        await pollyPoll.resolvePoll(pollId);
      }
      
      // Batch claim for user1
      const tx = await pollyPoll.connect(user1).batchClaim(pollIds);
      const receipt = await tx.wait();
      
      console.log("Gas used for batch claim (3 polls):", receipt.gasUsed.toString());
      
      // Check all claims were successful
      const claimEvents = receipt.events.filter(e => e.event === "WinningsClaimed");
      expect(claimEvents.length).to.equal(3);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause and unpause", async function () {
      const { pollyPoll, owner, user1 } = await loadFixture(deployPollyPollFixture);
      
      // Pause contract
      await pollyPoll.connect(owner).pause();
      
      // Try to create poll while paused
      await expect(
        pollyPoll.createPoll(
          "https://base.org/article",
          "Test?",
          ["Yes", "No"],
          BASE_TOKENS.ETH,
          24
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause
      await pollyPoll.connect(owner).unpause();
      
      // Should work now
      await expect(
        pollyPoll.createPoll(
          "https://base.org/article",
          "Test?",
          ["Yes", "No"],
          BASE_TOKENS.ETH,
          24
        )
      ).to.not.be.reverted;
    });

    it("Should allow owner to withdraw fees", async function () {
      const { pollyPoll, owner, user1, user2, feeRecipient } = await loadFixture(deployPollyPollFixture);
      
      // Create and resolve a poll with fees
      await pollyPoll.createPoll(
        "https://base.org/article",
        "Test?",
        ["Yes", "No"],
        BASE_TOKENS.ETH,
        24
      );
      
      await pollyPoll.connect(user1).placeBetETH(1, 0, {
        value: ethers.utils.parseEther("0.1")
      });
      await pollyPoll.connect(user2).placeBetETH(1, 1, {
        value: ethers.utils.parseEther("0.05")
      });
      
      await time.increase(24 * 60 * 60 + 1);
      await pollyPoll.resolvePoll(1);
      
      // Check fees collected
      const totalPool = ethers.utils.parseEther("0.15");
      const expectedFees = totalPool.mul(PLATFORM_FEE_BPS + CREATOR_REWARD_BPS).div(10000);
      
      const collectedFees = await pollyPoll.collectedFees(BASE_TOKENS.ETH);
      expect(collectedFees).to.equal(expectedFees);
      
      // Withdraw fees
      const feeRecipientBalanceBefore = await feeRecipient.getBalance();
      await pollyPoll.connect(owner).withdrawFees(BASE_TOKENS.ETH);
      const feeRecipientBalanceAfter = await feeRecipient.getBalance();
      
      expect(feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore)).to.equal(expectedFees);
    });

    it("Should allow setting minimum participants", async function () {
      const { pollyPoll, owner } = await loadFixture(deployPollyPollFixture);
      
      // Default should be 2
      expect(await pollyPoll.minParticipants()).to.equal(2);
      
      // Change to 3
      await pollyPoll.connect(owner).setMinParticipants(3);
      expect(await pollyPoll.minParticipants()).to.equal(3);
      
      // Cannot set too high
      await expect(
        pollyPoll.connect(owner).setMinParticipants(11)
      ).to.be.revertedWith("Too high");
    });
  });

  describe("Protocol Statistics", function () {
    it("Should track protocol-wide statistics", async function () {
      const { pollyPoll, user1, user2 } = await loadFixture(deployPollyPollFixture);
      
      // Initial stats
      let stats = await pollyPoll.getProtocolStats();
      expect(stats.totalPolls).to.equal(0);
      expect(stats.totalBets).to.equal(0);
      expect(stats.totalVolume).to.equal(0);
      
      // Create poll and place bets
      await pollyPoll.createPoll(
        "https://base.org/article",
        "Test?",
        ["Yes", "No"],
        BASE_TOKENS.ETH,
        24
      );
      
      await pollyPoll.connect(user1).placeBetETH(1, 0, {
        value: ethers.utils.parseEther("0.1")
      });
      await pollyPoll.connect(user2).placeBetETH(1, 1, {
        value: ethers.utils.parseEther("0.05")
      });
      
      // Check updated stats
      stats = await pollyPoll.getProtocolStats();
      expect(stats.totalPolls).to.equal(1);
      expect(stats.totalBets).to.equal(2);
      expect(stats.totalVolume).to.equal(ethers.utils.parseEther("0.15"));
      expect(stats.activePollsCount).to.equal(1);
      
      // Resolve poll
      await time.increase(24 * 60 * 60 + 1);
      await pollyPoll.resolvePoll(1);
      
      stats = await pollyPoll.getProtocolStats();
      expect(stats.activePollsCount).to.equal(0);
    });

    it("Should track token-specific volume", async function () {
      const { pollyPoll, user1 } = await loadFixture(deployPollyPollFixture);
      
      // Create ETH poll
      await pollyPoll.createPoll(
        "https://base.org/eth",
        "ETH poll?",
        ["Yes", "No"],
        BASE_TOKENS.ETH,
        24
      );
      
      await pollyPoll.connect(user1).placeBetETH(1, 0, {
        value: ethers.utils.parseEther("0.1")
      });
      
      // Check ETH volume
      const ethVolume = await pollyPoll.getTokenVolume(BASE_TOKENS.ETH);
      expect(ethVolume).to.equal(ethers.utils.parseEther("0.1"));
      
      // USDC volume should be 0
      const usdcVolume = await pollyPoll.getTokenVolume(BASE_TOKENS.USDC);
      expect(usdcVolume).to.equal(0);
    });
  });
});