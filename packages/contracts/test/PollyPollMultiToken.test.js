// test/PollyPollMultiToken.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PollyPollMultiToken", function () {
  // Constants
  const POLL_DURATION = 24 * 60 * 60; // 24 hours
  const PLATFORM_FEE_BPS = 250; // 2.5%
  
  // Fixtures
  async function deployPollyPollMultiTokenFixture() {
    const [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();
    
    const MockPYUSD = await ethers.getContractFactory("MockPYUSD");
    const mockPYUSD = await MockPYUSD.deploy();
    await mockPYUSD.deployed();
    
    const MockDAI = await ethers.getContractFactory("MockDAI");
    const mockDAI = await MockDAI.deploy();
    await mockDAI.deployed();
    
    // Deploy PollyPollMultiToken
    const PollyPollMultiToken = await ethers.getContractFactory("PollyPollMultiToken");
    const pollyPoll = await PollyPollMultiToken.deploy(
      feeRecipient.address,
      mockUSDC.address,
      mockPYUSD.address
    );
    await pollyPoll.deployed();
    
    // Add DAI as accepted token
    await pollyPoll.addToken(
      mockDAI.address,
      "DAI",
      18,
      ethers.utils.parseEther("1"),
      ethers.utils.parseEther("10000")
    );
    
    // Mint tokens to users for testing
    const mintAmount = ethers.utils.parseUnits("10000", 6); // for USDC/PYUSD
    const mintAmountDAI = ethers.utils.parseEther("10000"); // for DAI
    
    for (const user of [user1, user2, user3]) {
      await mockUSDC.mint(user.address, mintAmount);
      await mockPYUSD.mint(user.address, mintAmount);
      await mockDAI.mint(user.address, mintAmountDAI);
      
      // Approve spending
      await mockUSDC.connect(user).approve(pollyPoll.address, ethers.constants.MaxUint256);
      await mockPYUSD.connect(user).approve(pollyPoll.address, ethers.constants.MaxUint256);
      await mockDAI.connect(user).approve(pollyPoll.address, ethers.constants.MaxUint256);
    }
    
    return { 
      pollyPoll, 
      mockUSDC, 
      mockPYUSD, 
      mockDAI,
      owner, 
      user1, 
      user2, 
      user3, 
      feeRecipient 
    };
  }

  async function createPollFixture() {
    const fixture = await deployPollyPollMultiTokenFixture();
    const { pollyPoll, mockUSDC } = fixture;
    
    const articleUrl = "https://example.com/article";
    const question = "Will crypto adoption increase?";
    const options = ["Yes", "No", "Maybe"];
    
    const tx = await pollyPoll.createPoll(
      articleUrl,
      question,
      options,
      mockUSDC.address // USDC poll
    );
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "PollCreated");
    const pollId = event.args.pollId;
    
    return { ...fixture, pollId };
  }

  describe("Deployment", function () {
    it("Should set the correct fee recipient", async function () {
      const { pollyPoll, feeRecipient } = await loadFixture(deployPollyPollMultiTokenFixture);
      expect(await pollyPoll.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("Should configure FLOW as native token", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollMultiTokenFixture);
      const nativeConfig = await pollyPoll.acceptedTokens(ethers.constants.AddressZero);
      expect(nativeConfig.isAccepted).to.be.true;
      expect(nativeConfig.symbol).to.equal("FLOW");
    });

    it("Should configure USDC and PYUSD", async function () {
      const { pollyPoll, mockUSDC, mockPYUSD } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      const usdcConfig = await pollyPoll.acceptedTokens(mockUSDC.address);
      expect(usdcConfig.isAccepted).to.be.true;
      expect(usdcConfig.symbol).to.equal("USDC");
      expect(usdcConfig.decimals).to.equal(6);
      
      const pyusdConfig = await pollyPoll.acceptedTokens(mockPYUSD.address);
      expect(pyusdConfig.isAccepted).to.be.true;
      expect(pyusdConfig.symbol).to.equal("PYUSD");
      expect(pyusdConfig.decimals).to.equal(6);
    });
  });

  describe("Poll Creation", function () {
    it("Should create a poll with USDC", async function () {
      const { pollyPoll, mockUSDC } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      const articleUrl = "https://example.com/article";
      const question = "Test question?";
      const options = ["Option 1", "Option 2"];
      
      await expect(pollyPoll.createPoll(articleUrl, question, options, mockUSDC.address))
        .to.emit(pollyPoll, "PollCreated")
        .withArgs(1, articleUrl, mockUSDC.address, "USDC", await pollyPoll.signer.getAddress());
    });

    it("Should create a poll with FLOW (native)", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      const articleUrl = "https://example.com/article";
      const question = "Test question?";
      const options = ["Option 1", "Option 2"];
      
      await expect(pollyPoll.createPoll(articleUrl, question, options, ethers.constants.AddressZero))
        .to.emit(pollyPoll, "PollCreated")
        .withArgs(1, articleUrl, ethers.constants.AddressZero, "FLOW", await pollyPoll.signer.getAddress());
    });

    it("Should reject polls with unaccepted tokens", async function () {
      const { pollyPoll } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      const randomAddress = ethers.Wallet.createRandom().address;
      await expect(
        pollyPoll.createPoll("https://url.com", "Question", ["A", "B"], randomAddress)
      ).to.be.revertedWith("Token not accepted");
    });

    it("Should enforce daily poll limit", async function () {
      const { pollyPoll, mockUSDC } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      // Create 10 polls (the maximum)
      for (let i = 0; i < 10; i++) {
        await pollyPoll.createPoll(
          `https://url${i}.com`, 
          `Question ${i}`, 
          ["Yes", "No"], 
          mockUSDC.address
        );
      }
      
      // 11th poll should fail
      await expect(
        pollyPoll.createPoll("https://url11.com", "Question 11", ["Yes", "No"], mockUSDC.address)
      ).to.be.revertedWith("Daily limit reached");
    });
  });

  describe("Betting with Tokens", function () {
    it("Should place a bet with USDC", async function () {
      const { pollyPoll, pollId, user1, mockUSDC } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseUnits("100", 6); // 100 USDC
      
      await expect(pollyPoll.connect(user1).placeBetToken(pollId, 0, betAmount))
        .to.emit(pollyPoll, "BetPlaced")
        .withArgs(pollId, user1.address, 0, betAmount, mockUSDC.address);
      
      // Check token transfer
      const contractBalance = await mockUSDC.balanceOf(pollyPoll.address);
      expect(contractBalance).to.equal(betAmount);
    });

    it("Should place a bet with PYUSD", async function () {
      const { pollyPoll, mockPYUSD, user1 } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      // Create PYUSD poll
      const tx = await pollyPoll.createPoll(
        "https://example.com/article",
        "PYUSD Poll?",
        ["Yes", "No"],
        mockPYUSD.address
      );
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "PollCreated");
      const pollId = event.args.pollId;
      
      const betAmount = ethers.utils.parseUnits("50", 6); // 50 PYUSD
      
      await expect(pollyPoll.connect(user1).placeBetToken(pollId, 0, betAmount))
        .to.emit(pollyPoll, "BetPlaced")
        .withArgs(pollId, user1.address, 0, betAmount, mockPYUSD.address);
    });

    it("Should place a bet with native FLOW", async function () {
      const { pollyPoll, user1 } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      // Create FLOW poll
      const tx = await pollyPoll.createPoll(
        "https://example.com/article",
        "FLOW Poll?",
        ["Yes", "No"],
        ethers.constants.AddressZero
      );
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "PollCreated");
      const pollId = event.args.pollId;
      
      const betAmount = ethers.utils.parseEther("1"); // 1 FLOW
      
      await expect(
        pollyPoll.connect(user1).placeBetNative(pollId, 0, { value: betAmount })
      ).to.emit(pollyPoll, "BetPlaced")
        .withArgs(pollId, user1.address, 0, betAmount, ethers.constants.AddressZero);
    });

    it("Should enforce min/max bet limits", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      // Below minimum (< 1 USDC)
      await expect(
        pollyPoll.connect(user1).placeBetToken(pollId, 0, ethers.utils.parseUnits("0.5", 6))
      ).to.be.revertedWith("Invalid amount");
      
      // Above maximum (> 10,000 USDC)
      await expect(
        pollyPoll.connect(user1).placeBetToken(pollId, 0, ethers.utils.parseUnits("10001", 6))
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should prevent double voting", async function () {
      const { pollyPoll, pollId, user1 } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseUnits("100", 6);
      await pollyPoll.connect(user1).placeBetToken(pollId, 0, betAmount);
      
      await expect(
        pollyPoll.connect(user1).placeBetToken(pollId, 1, betAmount)
      ).to.be.revertedWith("Already voted");
    });

    it("Should calculate time bonuses correctly", async function () {
      const { pollyPoll, pollId, user1, user2, user3 } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseUnits("100", 6);
      
      // Early bird bonus (1.5x)
      await pollyPoll.connect(user1).placeBetToken(pollId, 0, betAmount);
      
      // Move to quick bonus period (1.3x)
      await time.increase(POLL_DURATION * 0.15); // 15% into poll
      const multiplier1 = await pollyPoll.getCurrentMultiplier(pollId);
      expect(multiplier1).to.be.within(13000, 13000); // 1.3x
      
      await pollyPoll.connect(user2).placeBetToken(pollId, 0, betAmount);
      
      // Move to normal bonus period (1.1x)
      await time.increase(POLL_DURATION * 0.20); // 35% into poll
      const multiplier2 = await pollyPoll.getCurrentMultiplier(pollId);
      expect(multiplier2).to.be.within(11000, 11000); // 1.1x
      
      await pollyPoll.connect(user3).placeBetToken(pollId, 0, betAmount);
    });
  });

  describe("Poll Resolution", function () {
    it("Should resolve poll correctly", async function () {
      const { pollyPoll, pollId, user1, user2 } = await loadFixture(createPollFixture);
      
      // Place bets
      await pollyPoll.connect(user1).placeBetToken(pollId, 0, ethers.utils.parseUnits("200", 6));
      await pollyPoll.connect(user2).placeBetToken(pollId, 1, ethers.utils.parseUnits("100", 6));
      
      // Fast forward past poll end
      await time.increase(POLL_DURATION + 1);
      
      // Resolve
      await expect(pollyPoll.resolvePoll(pollId))
        .to.emit(pollyPoll, "PollResolved");
      
      // Check winner (option 0 had more bets)
      const pollDetails = await pollyPoll.getPollDetails(pollId);
      expect(pollDetails.winningOption).to.equal(0);
    });

    it("Should calculate platform fee correctly", async function () {
      const { pollyPoll, pollId, user1, mockUSDC } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseUnits("1000", 6);
      await pollyPoll.connect(user1).placeBetToken(pollId, 0, betAmount);
      
      await time.increase(POLL_DURATION + 1);
      
      await pollyPoll.resolvePoll(pollId);
      
      const collectedFees = await pollyPoll.collectedFees(mockUSDC.address);
      const expectedFee = betAmount.mul(PLATFORM_FEE_BPS).div(10000);
      expect(collectedFees).to.equal(expectedFee);
    });
  });

  describe("Claiming Winnings", function () {
    it("Should allow winners to claim with correct token", async function () {
      const { pollyPoll, pollId, user1, user2, mockUSDC } = await loadFixture(createPollFixture);
      
      const bet1 = ethers.utils.parseUnits("200", 6);
      const bet2 = ethers.utils.parseUnits("100", 6);
      
      await pollyPoll.connect(user1).placeBetToken(pollId, 0, bet1);
      await pollyPoll.connect(user2).placeBetToken(pollId, 1, bet2);
      
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId);
      
      const balanceBefore = await mockUSDC.balanceOf(user1.address);
      
      await expect(pollyPoll.connect(user1).claimWinnings(pollId))
        .to.emit(pollyPoll, "WinningsClaimed");
      
      const balanceAfter = await mockUSDC.balanceOf(user1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should handle batch claims across multiple tokens", async function () {
      const { pollyPoll, mockUSDC, mockPYUSD, user1 } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      // Create and bet on USDC poll
      const tx1 = await pollyPoll.createPoll("url1", "Q1?", ["Yes", "No"], mockUSDC.address);
      const receipt1 = await tx1.wait();
      const pollId1 = receipt1.events.find(e => e.event === "PollCreated").args.pollId;
      await pollyPoll.connect(user1).placeBetToken(pollId1, 0, ethers.utils.parseUnits("100", 6));
      
      // Create and bet on PYUSD poll
      const tx2 = await pollyPoll.createPoll("url2", "Q2?", ["Yes", "No"], mockPYUSD.address);
      const receipt2 = await tx2.wait();
      const pollId2 = receipt2.events.find(e => e.event === "PollCreated").args.pollId;
      await pollyPoll.connect(user1).placeBetToken(pollId2, 0, ethers.utils.parseUnits("100", 6));
      
      // Fast forward and resolve
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId1);
      await pollyPoll.resolvePoll(pollId2);
      
      // Batch claim
      await pollyPoll.connect(user1).batchClaim([pollId1, pollId2]);
      
      // Both tokens should have increased
      const usdcBalance = await mockUSDC.balanceOf(user1.address);
      const pyusdBalance = await mockPYUSD.balanceOf(user1.address);
      
      expect(usdcBalance).to.be.gt(ethers.utils.parseUnits("9900", 6)); // Started with 10000, bet 100
      expect(pyusdBalance).to.be.gt(ethers.utils.parseUnits("9900", 6));
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to add new tokens", async function () {
      const { pollyPoll, owner } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      const newToken = ethers.Wallet.createRandom().address;
      
      await expect(
        pollyPoll.connect(owner).addToken(
          newToken,
          "TEST",
          18,
          ethers.utils.parseEther("1"),
          ethers.utils.parseEther("1000")
        )
      ).to.emit(pollyPoll, "TokenAdded")
        .withArgs(newToken, "TEST", ethers.utils.parseEther("1"));
      
      const config = await pollyPoll.acceptedTokens(newToken);
      expect(config.isAccepted).to.be.true;
      expect(config.symbol).to.equal("TEST");
    });

    it("Should allow owner to remove tokens", async function () {
      const { pollyPoll, mockDAI, owner } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      await expect(pollyPoll.connect(owner).removeToken(mockDAI.address))
        .to.emit(pollyPoll, "TokenRemoved")
        .withArgs(mockDAI.address);
      
      const config = await pollyPoll.acceptedTokens(mockDAI.address);
      expect(config.isAccepted).to.be.false;
    });

    it("Should allow owner to withdraw fees per token", async function () {
      const { pollyPoll, pollId, user1, owner, feeRecipient, mockUSDC } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseUnits("1000", 6);
      await pollyPoll.connect(user1).placeBetToken(pollId, 0, betAmount);
      
      await time.increase(POLL_DURATION + 1);
      await pollyPoll.resolvePoll(pollId);
      
      const balanceBefore = await mockUSDC.balanceOf(feeRecipient.address);
      
      await pollyPoll.connect(owner).withdrawFees(mockUSDC.address);
      
      const balanceAfter = await mockUSDC.balanceOf(feeRecipient.address);
      const expectedFee = betAmount.mul(PLATFORM_FEE_BPS).div(10000);
      
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedFee);
    });

    it("Should prevent non-owners from admin functions", async function () {
      const { pollyPoll, user1 } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      await expect(
        pollyPoll.connect(user1).addToken(
          ethers.Wallet.createRandom().address,
          "TEST",
          18,
          1,
          1000
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    it("Should return correct poll details with token info", async function () {
      const { pollyPoll, pollId, user1, mockUSDC } = await loadFixture(createPollFixture);
      
      const betAmount = ethers.utils.parseUnits("100", 6);
      await pollyPoll.connect(user1).placeBetToken(pollId, 0, betAmount);
      
      const details = await pollyPoll.connect(user1).getPollDetails(pollId);
      
      expect(details.pollId).to.equal(pollId);
      expect(details.paymentToken).to.equal(mockUSDC.address);
      expect(details.tokenSymbol).to.equal("USDC");
      expect(details.totalPool).to.equal(betAmount);
      expect(details.hasUserVoted).to.be.true;
      expect(details.userOption).to.equal(0);
      expect(details.userAmount).to.equal(betAmount);
    });

    it("Should track polls per article", async function () {
      const { pollyPoll, mockUSDC, mockPYUSD } = await loadFixture(deployPollyPollMultiTokenFixture);
      
      const articleUrl = "https://shared-article.com";
      
      // Create multiple polls for same article with different tokens
      await pollyPoll.createPoll(articleUrl, "Q1?", ["A", "B"], mockUSDC.address);
      await pollyPoll.createPoll(articleUrl, "Q2?", ["C", "D"], mockPYUSD.address);
      await pollyPoll.createPoll(articleUrl, "Q3?", ["E", "F"], ethers.constants.AddressZero);
      
      const articlePolls = await pollyPoll.getArticlePolls(articleUrl);
      expect(articlePolls.length).to.equal(3);
    });
  });
});