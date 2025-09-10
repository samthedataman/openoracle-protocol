// scripts/test-contract.js
// Comprehensive testing and monitoring script for PollyPoll contract

const { ethers } = require("hardhat");
const chalk = require("chalk");
const Table = require("cli-table3");
const readline = require("readline");
require("dotenv").config();

// Base Mainnet token addresses
const TOKENS = {
  ETH: "0x0000000000000000000000000000000000000000",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  PYUSD: "0xCaA940D48b22B8f3fb53b7d5EB0a0e43Bc261D3c",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"
};

// Test configuration
const TEST_CONFIG = {
  smallBet: "0.0001",  // Small test bet in ETH
  mediumBet: "0.001",  // Medium test bet
  largeBet: "0.01",    // Large test bet
  pollDuration: 24,    // Default poll duration in hours
};

class PolyPollTester {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.contract = null;
    this.signer = null;
    this.provider = null;
  }

  async initialize() {
    [this.signer] = await ethers.getSigners();
    this.contract = await ethers.getContractAt("PolyPoll", this.contractAddress);
    this.provider = this.signer.provider;
    
    console.log(chalk.green("✅ Contract initialized"));
    console.log(chalk.gray(`   Address: ${this.contractAddress}`));
    console.log(chalk.gray(`   Signer: ${this.signer.address}\n`));
  }

  // Display contract overview
  async displayContractStatus() {
    console.log(chalk.cyan.bold("\n📊 PollyPoll Contract Status"));
    console.log(chalk.gray("━".repeat(50)));

    // Get contract balance
    const contractBalance = await this.provider.getBalance(this.contractAddress);
    const contractETH = ethers.utils.formatEther(contractBalance);
    const contractUSD = (parseFloat(contractETH) * 4000).toFixed(2);
    
    console.log(chalk.white(`💰 Contract Balance: ${chalk.yellow(contractETH)} ETH ${chalk.gray(`($${contractUSD})`)}`));
    
    // Get protocol stats
    const stats = await this.contract.getProtocolStats();
    console.log(chalk.white(`📝 Total Polls Created: ${chalk.yellow(stats.totalPolls.toString())}`));
    console.log(chalk.white(`🎯 Total Bets Placed: ${chalk.yellow(stats.totalBets.toString())}`));
    console.log(chalk.white(`📊 Active Polls: ${chalk.yellow(stats.activePollsCount.toString())}`));
    console.log(chalk.white(`💸 Total Volume: ${chalk.yellow(ethers.utils.formatEther(stats.totalVolume))} ETH equivalent`));
    
    // Get collected fees
    const ethFees = await this.contract.collectedFees(TOKENS.ETH);
    if (ethFees.gt(0)) {
      console.log(chalk.white(`🏦 Collected ETH Fees: ${chalk.yellow(ethers.utils.formatEther(ethFees))} ETH`));
    }
    
    console.log();
  }

  // Display all active polls
  async displayActivePolls() {
    console.log(chalk.cyan.bold("\n🗳️ Active Polls"));
    console.log(chalk.gray("━".repeat(50)));

    const stats = await this.contract.getProtocolStats();
    const totalPolls = stats.totalPolls.toNumber();
    
    if (totalPolls === 0) {
      console.log(chalk.yellow("No polls created yet\n"));
      return;
    }

    let activePollsFound = false;
    
    for (let i = 1; i <= totalPolls; i++) {
      try {
        const pollDetails = await this.contract.getPollDetails(i, this.signer.address);
        
        if (!pollDetails.resolved && pollDetails.endTime.gt(Math.floor(Date.now() / 1000))) {
          activePollsFound = true;
          await this.displayPollDetails(i, pollDetails);
        }
      } catch (error) {
        // Poll might not exist at this ID
        continue;
      }
    }
    
    if (!activePollsFound) {
      console.log(chalk.yellow("No active polls at the moment\n"));
    }
  }

  // Display detailed poll information
  async displayPollDetails(pollId, details) {
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = details.endTime.sub(now);
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    
    // Get current multiplier
    let multiplier = "1.0x";
    try {
      const mult = await this.contract.getCurrentMultiplier(pollId);
      multiplier = (mult.toNumber() / 10000).toFixed(1) + "x";
    } catch (e) {}
    
    console.log(chalk.blue.bold(`\nPoll #${pollId}: "${details.question}"`));
    console.log(chalk.gray(`├─ Status: ${chalk.green("ACTIVE")} (${hours}h ${minutes}m remaining)`));
    console.log(chalk.gray(`├─ Token: ${details.tokenSymbol}`));
    console.log(chalk.gray(`├─ Total Pool: ${ethers.utils.formatEther(details.totalPool)} ${details.tokenSymbol}`));
    console.log(chalk.gray(`├─ Participants: ${details.participantCount}`));
    console.log(chalk.gray(`├─ Current Multiplier: ${chalk.yellow(multiplier)}`));
    console.log(chalk.gray(`├─ Options:`));
    
    for (let i = 0; i < details.options.length; i++) {
      const pool = ethers.utils.formatEther(details.optionPools[i]);
      const percentage = details.totalPool.gt(0) 
        ? details.optionPools[i].mul(100).div(details.totalPool).toString()
        : "0";
      
      const optionLine = `│  ${i === details.options.length - 1 ? '└' : '├'}─ [${i}] ${details.options[i]}: ${pool} ${details.tokenSymbol} (${percentage}%)`;
      console.log(chalk.gray(optionLine));
    }
    
    if (details.hasUserVoted) {
      const userAmount = ethers.utils.formatEther(details.userAmount);
      console.log(chalk.green(`└─ ✅ Your Vote: Option ${details.userOption} (${userAmount} ${details.tokenSymbol})`));
    } else {
      console.log(chalk.yellow(`└─ ⚠️ You haven't voted yet`));
    }
  }

  // Create a test poll
  async createTestPoll(token = TOKENS.ETH) {
    console.log(chalk.cyan.bold("\n🆕 Creating Test Poll..."));
    
    const questions = [
      "Will Base TVL exceed $10B by Q2 2025?",
      "Is this the best L2 for DeFi?",
      "Will gas fees stay below 1 gwei?",
      "Should we add more token support?",
    ];
    
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    const articleUrl = `https://test.article${Date.now()}.com`;
    const options = ["Yes", "No", "Maybe"];
    const duration = TEST_CONFIG.pollDuration;
    
    console.log(chalk.gray(`Question: ${randomQ}`));
    console.log(chalk.gray(`Token: ${token === TOKENS.ETH ? "ETH" : "Token"}`));
    console.log(chalk.gray(`Duration: ${duration} hours`));
    
    try {
      const tx = await this.contract.createPoll(
        articleUrl,
        randomQ,
        options,
        token,
        duration
      );
      
      console.log(chalk.gray(`Transaction: ${tx.hash}`));
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "PollCreated");
      const pollId = event.args.pollId;
      
      console.log(chalk.green(`✅ Poll #${pollId} created successfully!\n`));
      return pollId.toNumber();
      
    } catch (error) {
      console.log(chalk.red(`❌ Failed to create poll: ${error.message}\n`));
      return null;
    }
  }

  // Place a test bet
  async placeTestBet(pollId, option, amountETH) {
    console.log(chalk.cyan.bold(`\n💰 Placing Bet on Poll #${pollId}...`));
    
    try {
      // Check if already voted
      const details = await this.contract.getPollDetails(pollId, this.signer.address);
      
      if (details.hasUserVoted) {
        console.log(chalk.yellow("⚠️ You've already voted on this poll!"));
        console.log(chalk.gray(`   Previous vote: Option ${details.userOption}`));
        console.log(chalk.gray(`   Amount: ${ethers.utils.formatEther(details.userAmount)} ${details.tokenSymbol}\n`));
        return false;
      }
      
      console.log(chalk.gray(`Option: ${option} - "${details.options[option]}"`));
      console.log(chalk.gray(`Amount: ${amountETH} ETH`));
      
      // Get contract balance before
      const balanceBefore = await this.provider.getBalance(this.contractAddress);
      
      // Place bet
      const tx = await this.contract.placeBetETH(pollId, option, {
        value: ethers.utils.parseEther(amountETH)
      });
      
      console.log(chalk.gray(`Transaction: ${tx.hash}`));
      const receipt = await tx.wait();
      
      // Get contract balance after
      const balanceAfter = await this.provider.getBalance(this.contractAddress);
      const balanceIncrease = ethers.utils.formatEther(balanceAfter.sub(balanceBefore));
      
      console.log(chalk.green(`✅ Bet placed successfully!`));
      console.log(chalk.gray(`   Contract balance increased by: ${balanceIncrease} ETH`));
      
      // Get bet event details
      const betEvent = receipt.events.find(e => e.event === "BetPlaced");
      if (betEvent) {
        const weightedAmount = ethers.utils.formatEther(betEvent.args.weightedAmount);
        console.log(chalk.gray(`   Weighted amount: ${weightedAmount} (with time bonus)\n`));
      }
      
      return true;
      
    } catch (error) {
      console.log(chalk.red(`❌ Failed to place bet: ${error.message}\n`));
      return false;
    }
  }

  // Test double voting (should fail)
  async testDoubleVoting(pollId) {
    console.log(chalk.cyan.bold("\n🔬 Testing Double Vote Prevention..."));
    
    try {
      // First bet
      console.log(chalk.gray("Placing first bet..."));
      await this.placeTestBet(pollId, 0, TEST_CONFIG.smallBet);
      
      // Try second bet (should fail)
      console.log(chalk.gray("Attempting second bet (should fail)..."));
      await this.placeTestBet(pollId, 1, TEST_CONFIG.smallBet);
      
    } catch (error) {
      if (error.message.includes("Already voted")) {
        console.log(chalk.green("✅ Double voting correctly prevented!\n"));
      } else {
        console.log(chalk.red(`❌ Unexpected error: ${error.message}\n`));
      }
    }
  }

  // Monitor a specific poll
  async monitorPoll(pollId) {
    console.log(chalk.cyan.bold(`\n📊 Monitoring Poll #${pollId}`));
    console.log(chalk.gray("Press Ctrl+C to stop monitoring\n"));
    
    const updateInterval = setInterval(async () => {
      try {
        const details = await this.contract.getPollDetails(pollId, this.signer.address);
        
        // Clear console and redraw
        console.clear();
        console.log(chalk.cyan.bold(`📊 Live Monitor - Poll #${pollId}`));
        console.log(chalk.gray("━".repeat(50)));
        
        await this.displayPollDetails(pollId, details);
        
        // Show contract balance
        const balance = await this.provider.getBalance(this.contractAddress);
        console.log(chalk.white(`\n💰 Contract Balance: ${ethers.utils.formatEther(balance)} ETH`));
        
        // Check if poll ended
        if (details.resolved || details.endTime.lte(Math.floor(Date.now() / 1000))) {
          console.log(chalk.yellow("\n⏰ Poll has ended!"));
          clearInterval(updateInterval);
        }
        
      } catch (error) {
        console.log(chalk.red(`Error: ${error.message}`));
        clearInterval(updateInterval);
      }
    }, 5000); // Update every 5 seconds
  }

  // Run automated test suite
  async runTestSuite() {
    console.log(chalk.cyan.bold("\n🧪 Running Automated Test Suite"));
    console.log(chalk.gray("━".repeat(50)));
    
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Test 1: Create Poll
    console.log(chalk.blue("\nTest 1: Create Poll"));
    const pollId = await this.createTestPoll();
    if (pollId) {
      results.passed++;
      results.tests.push({ name: "Create Poll", status: "✅ PASSED" });
    } else {
      results.failed++;
      results.tests.push({ name: "Create Poll", status: "❌ FAILED" });
      return results;
    }
    
    // Test 2: Place Bet
    console.log(chalk.blue("\nTest 2: Place Bet"));
    const betSuccess = await this.placeTestBet(pollId, 0, TEST_CONFIG.smallBet);
    if (betSuccess) {
      results.passed++;
      results.tests.push({ name: "Place Bet", status: "✅ PASSED" });
    } else {
      results.failed++;
      results.tests.push({ name: "Place Bet", status: "❌ FAILED" });
    }
    
    // Test 3: Double Vote Prevention
    console.log(chalk.blue("\nTest 3: Prevent Double Voting"));
    try {
      await this.contract.placeBetETH(pollId, 1, {
        value: ethers.utils.parseEther(TEST_CONFIG.smallBet)
      });
      results.failed++;
      results.tests.push({ name: "Prevent Double Vote", status: "❌ FAILED" });
    } catch (error) {
      if (error.message.includes("Already voted")) {
        results.passed++;
        results.tests.push({ name: "Prevent Double Vote", status: "✅ PASSED" });
      } else {
        results.failed++;
        results.tests.push({ name: "Prevent Double Vote", status: "❌ FAILED" });
      }
    }
    
    // Test 4: Check Contract Balance
    console.log(chalk.blue("\nTest 4: Contract Balance Tracking"));
    const balance = await this.provider.getBalance(this.contractAddress);
    if (balance.gt(0)) {
      results.passed++;
      results.tests.push({ name: "Balance Tracking", status: "✅ PASSED" });
      console.log(chalk.gray(`   Contract holds: ${ethers.utils.formatEther(balance)} ETH`));
    } else {
      results.failed++;
      results.tests.push({ name: "Balance Tracking", status: "❌ FAILED" });
    }
    
    // Display results
    console.log(chalk.cyan.bold("\n📋 Test Results"));
    console.log(chalk.gray("━".repeat(50)));
    
    const table = new Table({
      head: ["Test", "Status"],
      style: { head: ["cyan"] }
    });
    
    results.tests.forEach(test => {
      table.push([test.name, test.status]);
    });
    
    console.log(table.toString());
    console.log(chalk.white(`\nTotal: ${chalk.green(results.passed + " passed")}, ${chalk.red(results.failed + " failed")}\n`));
    
    return results;
  }

  // Interactive menu
  async interactiveMenu() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const askQuestion = (question) => {
      return new Promise((resolve) => {
        rl.question(question, resolve);
      });
    };
    
    while (true) {
      console.log(chalk.cyan.bold("\n🦜 PollyPoll Test Menu"));
      console.log(chalk.gray("━".repeat(30)));
      console.log("1. Display Contract Status");
      console.log("2. Show Active Polls");
      console.log("3. Create Test Poll");
      console.log("4. Place Test Bet");
      console.log("5. Test Double Voting");
      console.log("6. Monitor Poll (Live)");
      console.log("7. Run Full Test Suite");
      console.log("8. Exit");
      
      const choice = await askQuestion(chalk.cyan("\nSelect option (1-8): "));
      
      switch(choice) {
        case '1':
          await this.displayContractStatus();
          break;
        case '2':
          await this.displayActivePolls();
          break;
        case '3':
          await this.createTestPoll();
          break;
        case '4':
          const pollId = await askQuestion("Enter poll ID: ");
          const option = await askQuestion("Enter option (0, 1, 2): ");
          const amount = await askQuestion("Enter amount in ETH: ");
          await this.placeTestBet(pollId, option, amount);
          break;
        case '5':
          const testPollId = await askQuestion("Enter poll ID to test: ");
          await this.testDoubleVoting(testPollId);
          break;
        case '6':
          const monitorId = await askQuestion("Enter poll ID to monitor: ");
          await this.monitorPoll(monitorId);
          break;
        case '7':
          await this.runTestSuite();
          break;
        case '8':
          rl.close();
          process.exit(0);
        default:
          console.log(chalk.red("Invalid option"));
      }
      
      await askQuestion(chalk.gray("\nPress Enter to continue..."));
    }
  }
}

// Main execution
async function main() {
  console.log(chalk.cyan.bold("========================================"));
  console.log(chalk.cyan.bold("    PolyPoll Contract Test Suite"));
  console.log(chalk.cyan.bold("========================================"));
  
  // Use deployed contract address
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
  console.log(chalk.blue(`Testing contract: ${contractAddress}\n`));
  
  // Initialize tester
  const tester = new PolyPollTester(contractAddress);
  await tester.initialize();
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args[0] === "status") {
    await tester.displayContractStatus();
  } else if (args[0] === "polls") {
    await tester.displayActivePolls();
  } else if (args[0] === "create") {
    await tester.createTestPoll();
  } else if (args[0] === "test") {
    await tester.runTestSuite();
  } else if (args[0] === "monitor" && args[1]) {
    await tester.monitorPoll(args[1]);
  } else {
    // Run interactive menu
    await tester.interactiveMenu();
  }
}

// Run the script
main()
  .then(() => {
    console.log(chalk.green("\n✨ Test session complete!\n"));
  })
  .catch((error) => {
    console.error(chalk.red("\n❌ Error:"), error);
    process.exit(1);
  });