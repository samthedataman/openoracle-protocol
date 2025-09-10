// test/PollyPoll.test.js
// Comprehensive tests for PollyPoll smart contract

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PollyPoll", function () {
  // Constants
  const POLL_DURATION = 24 * 60 * 60; // 24 hours
  const MIN_BET = ethers.utils.parseEther("0.001");
  const MAX_BET = ethers.utils.parseEther("100");
  const PLATFORM_FEE_BPS = 250; // 2.5%

  // Fixtures
  async function deployPollyPollFixture() {
    const [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();
    
    const PollyPoll = await ethers.getContractFactory("PollyPoll");
    const pollyPoll = await PollyPoll.deploy(feeRecipient.address);
    await pollyPoll.deployed();
    
    return { pollyPoll, owner, user1, user2, user3, feeRecipient };
  }

  async function createPollFixture() {
    const { pollyPoll, owner, user1, user2, user3, feeRecipient } = await deployPollyPollFixture();
    
    const articleUrl = "https://example.com/article";
    const question = "Will AI replace developers?";
    const options = ["Yes", "No", "Partially"];
    
    const tx = await pollyPoll.createPoll(articleUrl, question, options);
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "PollCreated");
    const pollId = event.args.pollId;
    
    return { pollyPoll, pollId, owner, user1, user2, user3, feeRecipient };
  }

  describe("Deployment", function () {
    it("Should set the correct fee recipient", async function () {
      const { pollyPoll, feeRecipient } = await loadFixture(deployPollyPollFixture);
      expect(await pollyPoll.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("Should initialize with zero fees collected", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      expect(await pollyPoll.totalFeesCollected()).to.equal(0);
    });
  });

  describe("Poll Creation", function () {
    it("Should create a poll successfully", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      const articleUrl = "https://example.com/article";
      const question = "Test question?";
      const options = ["Option 1", "Option 2"];
      
      await expect(pollyPoll.createPoll(articleUrl, question, options))
        .to.emit(pollyPoll, "PollCreated")
        .withArgs(1, articleUrl, question, await pollyPoll.signer.getAddress(), await time.latest() + POLL_DURATION + 1);
    });

    it("Should reject polls with invalid parameters", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      // Empty article URL
      await expect(pollyPoll.createPoll("", "Question", ["A", "B"]))
        .to.be.revertedWith("Invalid article URL");
      
      // Empty question
      await expect(pollyPoll.createPoll("https://url.com", "", ["A", "B"]))
        .to.be.revertedWith("Invalid question");
      
      // Too few options
      await expect(pollyPoll.createPoll("https://url.com", "Question", ["A"]))
        .to.be.revertedWith("Invalid option count");
      
      // Too many options
      await expect(pollyPoll.createPoll("https://url.com", "Question", ["A", "B", "C", "D", "E", "F"]))
        .to.be.revertedWith("Invalid option count");
    });

    it("Should enforce daily poll limit", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollFixture);
      
      // Create 10 polls (the maximum)
      for (let i = 0; i < 10; i++) {
        await pollyPoll.createPoll(`https://url${i}.com`, `Question ${i}`, ["Yes", "No"]);
      }
      
      // 11th poll should fail
      await expect(pollyPoll.createPoll("https://url11.com", "Question 11", ["Yes", "No"]))
        .to.be.revertedWith("Daily poll limit reached");
    });
  });

  describe("Betting", function () {
    it("Should place a bet successfully", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseEther("1");
      await expect(pollyPoll.connect(user1).placeBet(pollId, 0, { value: betAmount }))
        .to.emit(pollyPoll, "BetPlaced");
    });

    it("Should calculate time bonuses correctly", async function () {
      const { pollyPoll, pollId, user1, user2, user3 } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseEther("1");
      
      // Early bird bonus (1.5x)
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: betAmount });
      
      // Move to quick bonus period (1.3x)
      await time.increase(POLL_DURATION * 0.15); // 15% into poll
      await pollyPoll.connect(user2).placeBet(pollId, 0, { value: betAmount });
      
      // Check multipliers
      const multiplier1 = await pollyPoll.getCurrentMultiplier(pollId);
      expect(multiplier1).to.be.within(13000, 13000); // 1.3x in quick period
    });

    it("Should reject invalid bets", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      // Below minimum
      await expect(pollyPoll.connect(user1).placeBet(pollId, 0, { value: ethers.utils.parseEther("0.0001") }))
        .to.be.revertedWith("Invalid bet amount");
      
      // Above maximum
      await expect(pollyPoll.connect(user1).placeBet(pollId, 0, { value: ethers.utils.parseEther("101") }))
        .to.be.revertedWith("Invalid bet amount");
      
      // Invalid option
      await expect(pollyPoll.connect(user1).placeBet(pollId, 5, { value: MIN_BET }))
        .to.be.revertedWith("Invalid option");
    });

    it("Should prevent double voting", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: MIN_BET });
      
      await expect(pollyPoll.connect(user1).placeBet(pollId, 1, { value: MIN_BET }))
        .to.be.revertedWith("Already voted");
    });
  });

  describe("Poll Resolution", function () {
    it("Should resolve poll correctly", async function () {
      const { pollyPoll, pollId, user1, user2 } = await loadFixture(createPollFixture);
      
      // Place bets
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: ethers.utils.parseEther("2") });
      await pollyPoll.connect(user2).placeBet(pollId, 1, { value: ethers.utils.parseEther("1") });
      
      // Fast forward past poll end
      await time.increase(POLL_DURATION + 1);
      
      // Resolve
      await expect(pollyPoll.resolvePoll(pollId))
        .to.emit(pollyPoll, "PollResolved");
      
      // Check winner (option 0 had more bets)
      const pollDetails = await pollyPoll.getPollDetails(pollId, user1.address);
      expect(pollDetails.winningOption).to.equal(0);
    });

    it("Should calculate platform fee correctly", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseEther("10");
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: betAmount });
      
      await time.increase(POLL_DURATION + 1);
      
      const tx = await pollyPoll.resolvePoll(pollId);
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "PollResolved");
      
      const expectedFee = betAmount.mul(PLATFORM_FEE_BPS).div(10000);
      expect(event.args.platformFee).to.equal(expectedFee);
    });

    it("Should prevent resolution before poll ends", async function () {
      const { pollyPoll, pollId } = await loadFixture(createPollFixture);
      
      await expect(pollyPoll.resolvePoll(pollId))
        .to.be.revertedWith("Poll still active");
    });

    it("Should prevent double resolution", async function () {
      const { pollyPoll, pollId } = await loadFixture(createPollFixture);
      
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId);
      
      await expect(pollyPoll.resolvePoll(pollId))
        .to.be.revertedWith("Poll already resolved");
    });
  });

  describe("Claiming Winnings", function () {
    it("Should allow winners to claim", async function () {
      const { pollyPoll, pollId, user1, user2 } = await loadFixture(createPollFixture);
      
      const bet1 = ethers.utils.parseEther("2");
      const bet2 = ethers.utils.parseEther("1");
      
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: bet1 });
      await pollyPoll.connect(user2).placeBet(pollId, 1, { value: bet2 });
      
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId);
      
      const balanceBefore = await user1.getBalance();
      
      await expect(pollyPoll.connect(user1).claimWinnings(pollId))
        .to.emit(pollyPoll, "WinningsClaimed");
      
      const balanceAfter = await user1.getBalance();
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should prevent losers from claiming", async function () {
      const { pollyPoll, pollId, user1, user2 } = await loadFixture(createPollFixture);
      
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: ethers.utils.parseEther("2") });
      await pollyPoll.connect(user2).placeBet(pollId, 1, { value: ethers.utils.parseEther("1") });
      
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId);
      
      // User2 lost (option 1 had less bets)
      const balanceBefore = await user2.getBalance();
      await pollyPoll.connect(user2).claimWinnings(pollId);
      const balanceAfter = await user2.getBalance();
      
      // Balance should only decrease (gas costs)
      expect(balanceAfter).to.be.lt(balanceBefore);
    });

    it("Should prevent double claiming", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: ethers.utils.parseEther("1") });
      
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId);
      
      await pollyPoll.connect(user1).claimWinnings(pollId);
      
      await expect(pollyPoll.connect(user1).claimWinnings(pollId))
        .to.be.revertedWith("Already claimed");
    });
  });

  describe("View Functions", function () {
    it("Should return correct poll details", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseEther("1");
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: betAmount });
      
      const details = await pollyPoll.getPollDetails(pollId, user1.address);
      
      expect(details.pollId).to.equal(pollId);
      expect(details.totalPool).to.equal(betAmount);
      expect(details.hasUserVoted).to.be.true;
      expect(details.userOption).to.equal(0);
      expect(details.userAmount).to.equal(betAmount);
    });

    it("Should calculate potential winnings", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseEther("1");
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: betAmount });
      
      const winnings = await pollyPoll.calculatePotentialWinnings(pollId, user1.address);
      
      // Should be approximately bet amount minus platform fee
      const expectedWinnings = betAmount.mul(10000 - PLATFORM_FEE_BPS).div(10000);
      expect(winnings).to.be.closeTo(expectedWinnings, ethers.utils.parseEther("0.01"));
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to withdraw fees", async function () {
      const { pollyPoll, pollId, user1, owner, feeRecipient } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseEther("10");
      await pollyPoll.connect(user1).placeBet(pollId, 0, { value: betAmount });
      
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId);
      
      const balanceBefore = await feeRecipient.getBalance();
      
      await expect(pollyPoll.connect(owner).withdrawFees())
        .to.emit(pollyPoll, "FeesWithdrawn");
      
      const balanceAfter = await feeRecipient.getBalance();
      const expectedFee = betAmount.mul(PLATFORM_FEE_BPS).div(10000);
      
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedFee);
    });

    it("Should prevent non-owners from withdrawing fees", async function () {
      const { pollyPoll, user1 } = await loadFixture(createPollFixture);
      
      await expect(pollyPoll.connect(user1).withdrawFees())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow emergency poll resolution", async function () {
      const { pollyPoll, pollId, owner } = await loadFixture(createPollFixture);
      
      await expect(pollyPoll.connect(owner).emergencyResolvePoll(pollId, 0))
        .to.emit(pollyPoll, "PollResolved");
    });
  });
});