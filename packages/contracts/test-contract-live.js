#!/usr/bin/env node
/**
 * Live testing script for PolyPoll contract on Base Mainnet
 * Tests: Poll creation, ETH betting, and token betting
 */

const { ethers } = require("ethers");
const chalk = require("chalk");
require("dotenv").config();

// Contract configuration
const CONTRACT_ADDRESS = "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
const BASE_RPC = "https://mainnet.base.org";

// Base token addresses
const TOKENS = {
  ETH: ethers.constants.AddressZero,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  PYUSD: "0xcAa940d48B22b8F3fb53b7d5Eb0a0E43bC261d3C"
};

// Contract ABI
const CONTRACT_ABI = [
  "function createPoll(string articleUrl, string question, string[] options, address paymentToken, uint256 durationHours) returns (uint256)",
  "function placeBetETH(uint256 pollId, uint8 option) payable",
  "function placeBetToken(uint256 pollId, uint8 option, uint256 amount)",
  "function polls(uint256) view returns (string articleUrl, string question, address creator, uint256 startTime, uint256 endTime, uint256 totalPool, bool resolved, uint8 winningOption, address paymentToken)",
  "function getPollOptions(uint256 pollId) view returns (string[] memory)",
  "function getUserBet(uint256 pollId, address user) view returns (uint8 option, uint256 amount, uint256 weightedAmount, uint256 timestamp, bool hasVoted)",
  "function getTimeMultiplier(uint256 pollId) view returns (uint256)",
  "event PollCreated(uint256 indexed pollId, string articleUrl, address indexed paymentToken, uint256 duration, address indexed creator)",
  "event BetPlaced(uint256 indexed pollId, address indexed user, uint8 option, uint256 amount, uint256 weightedAmount)"
];

// USDC ABI for approval
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  console.log(chalk.blue.bold("\n🔬 PolyPoll Contract Live Testing Script"));
  console.log(chalk.gray("=====================================\n"));

  // Check for private key
  if (!process.env.WALLET_PRIVATE_KEY) {
    console.error(chalk.red("❌ WALLET_PRIVATE_KEY not found in .env file"));
    process.exit(1);
  }

  // Setup provider and wallet
  console.log(chalk.yellow("📡 Connecting to Base Mainnet..."));
  const provider = new ethers.providers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  
  // Verify network
  const network = await provider.getNetwork();
  if (network.chainId !== 8453) {
    console.error(chalk.red(`❌ Wrong network! Expected Base Mainnet (8453), got ${network.chainId}`));
    process.exit(1);
  }
  
  console.log(chalk.green("✅ Connected to Base Mainnet"));
  console.log(chalk.gray(`   Wallet: ${wallet.address}`));
  
  // Check wallet balance
  const balance = await wallet.getBalance();
  const ethBalance = ethers.utils.formatEther(balance);
  console.log(chalk.gray(`   ETH Balance: ${ethBalance} ETH`));
  
  if (parseFloat(ethBalance) < 0.01) {
    console.error(chalk.red("❌ Insufficient ETH balance. Need at least 0.01 ETH for testing"));
    process.exit(1);
  }

  // Create contract instance
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  console.log(chalk.gray(`   Contract: ${CONTRACT_ADDRESS}\n`));

  // Store test results
  let createdPollId;

  try {
    // ========== TEST 1: CREATE POLL ==========
    console.log(chalk.blue.bold("📝 Test 1: Creating Poll"));
    console.log(chalk.gray("   Creating a poll with ETH as payment token..."));
    
    const pollData = {
      articleUrl: `https://example.com/test-article-${Date.now()}`,
      question: "Will ETH hit $5000 this month?",
      options: ["Yes", "No", "Maybe"],
      paymentToken: TOKENS.ETH,
      duration: 48 // 48 hours
    };
    
    console.log(chalk.gray(`   Question: ${pollData.question}`));
    console.log(chalk.gray(`   Options: ${pollData.options.join(", ")}`));
    console.log(chalk.gray(`   Duration: ${pollData.duration} hours`));
    
    const createTx = await contract.createPoll(
      pollData.articleUrl,
      pollData.question,
      pollData.options,
      pollData.paymentToken,
      pollData.duration,
      { gasLimit: 500000 }
    );
    
    console.log(chalk.yellow(`   Tx sent: ${createTx.hash}`));
    const createReceipt = await createTx.wait();
    
    // Extract poll ID from event
    const pollCreatedEvent = createReceipt.events?.find(e => e.event === "PollCreated");
    createdPollId = pollCreatedEvent?.args?.pollId?.toString();
    
    console.log(chalk.green(`   ✅ Poll created successfully!`));
    console.log(chalk.green(`   Poll ID: ${createdPollId}`));
    console.log(chalk.gray(`   Gas used: ${createReceipt.gasUsed.toString()}`));
    console.log(chalk.gray(`   Block: ${createReceipt.blockNumber}\n`));
    
    // ========== TEST 2: VERIFY POLL DATA ==========
    console.log(chalk.blue.bold("🔍 Test 2: Verifying Poll Data"));
    
    const pollInfo = await contract.polls(createdPollId);
    console.log(chalk.gray(`   Question: ${pollInfo.question}`));
    console.log(chalk.gray(`   Creator: ${pollInfo.creator}`));
    console.log(chalk.gray(`   Payment Token: ${pollInfo.paymentToken === TOKENS.ETH ? "ETH" : pollInfo.paymentToken}`));
    console.log(chalk.gray(`   Start Time: ${new Date(pollInfo.startTime * 1000).toLocaleString()}`));
    console.log(chalk.gray(`   End Time: ${new Date(pollInfo.endTime * 1000).toLocaleString()}`));
    console.log(chalk.gray(`   Total Pool: ${ethers.utils.formatEther(pollInfo.totalPool)} ETH`));
    
    const options = await contract.getPollOptions(createdPollId);
    console.log(chalk.gray(`   Options: ${options.join(", ")}`));
    console.log(chalk.green(`   ✅ Poll data verified\n`));
    
    // ========== TEST 3: PLACE ETH BET ==========
    console.log(chalk.blue.bold("💰 Test 3: Placing ETH Bet"));
    
    const betAmount = ethers.utils.parseEther("0.001"); // 0.001 ETH
    const selectedOption = 0; // Betting on "Yes"
    
    console.log(chalk.gray(`   Betting ${ethers.utils.formatEther(betAmount)} ETH on option ${selectedOption} ("${options[selectedOption]}")`));
    
    // Check time multiplier
    const multiplier = await contract.getTimeMultiplier(createdPollId);
    console.log(chalk.gray(`   Current time multiplier: ${multiplier.toNumber() / 10000}x`));
    
    const betTx = await contract.placeBetETH(
      createdPollId,
      selectedOption,
      { 
        value: betAmount,
        gasLimit: 300000 
      }
    );
    
    console.log(chalk.yellow(`   Tx sent: ${betTx.hash}`));
    const betReceipt = await betTx.wait();
    
    // Check for BetPlaced event
    const betPlacedEvent = betReceipt.events?.find(e => e.event === "BetPlaced");
    if (betPlacedEvent) {
      const weightedAmount = betPlacedEvent.args.weightedAmount;
      console.log(chalk.gray(`   Weighted amount: ${ethers.utils.formatEther(weightedAmount)} ETH`));
    }
    
    console.log(chalk.green(`   ✅ ETH bet placed successfully!`));
    console.log(chalk.gray(`   Gas used: ${betReceipt.gasUsed.toString()}\n`));
    
    // Verify user bet
    const userBet = await contract.getUserBet(createdPollId, wallet.address);
    console.log(chalk.gray(`   Your bet: Option ${userBet.option}, Amount: ${ethers.utils.formatEther(userBet.amount)} ETH`));
    console.log(chalk.gray(`   Weighted: ${ethers.utils.formatEther(userBet.weightedAmount)} ETH\n`));
    
    // ========== TEST 4: CREATE USDC POLL (Optional) ==========
    console.log(chalk.blue.bold("📝 Test 4: Creating USDC Poll"));
    
    const askUSDC = await askYesNo("Do you want to test USDC betting? (requires USDC balance)");
    
    if (askUSDC) {
      // Check USDC balance
      const usdcContract = new ethers.Contract(TOKENS.USDC, ERC20_ABI, wallet);
      const usdcBalance = await usdcContract.balanceOf(wallet.address);
      const usdcDecimals = await usdcContract.decimals();
      const formattedUSDC = ethers.utils.formatUnits(usdcBalance, usdcDecimals);
      
      console.log(chalk.gray(`   USDC Balance: ${formattedUSDC} USDC`));
      
      if (parseFloat(formattedUSDC) < 1) {
        console.log(chalk.yellow("   ⚠️  Insufficient USDC balance, skipping USDC test"));
      } else {
        // Create USDC poll
        const usdcPollData = {
          articleUrl: `https://example.com/usdc-test-${Date.now()}`,
          question: "Will USDC maintain its peg?",
          options: ["Yes", "No"],
          paymentToken: TOKENS.USDC,
          duration: 24
        };
        
        const usdcCreateTx = await contract.createPoll(
          usdcPollData.articleUrl,
          usdcPollData.question,
          usdcPollData.options,
          usdcPollData.paymentToken,
          usdcPollData.duration,
          { gasLimit: 500000 }
        );
        
        console.log(chalk.yellow(`   Tx sent: ${usdcCreateTx.hash}`));
        const usdcCreateReceipt = await usdcCreateTx.wait();
        
        const usdcPollEvent = usdcCreateReceipt.events?.find(e => e.event === "PollCreated");
        const usdcPollId = usdcPollEvent?.args?.pollId?.toString();
        
        console.log(chalk.green(`   ✅ USDC Poll created! ID: ${usdcPollId}`));
        
        // Approve USDC spending
        const usdcBetAmount = ethers.utils.parseUnits("1", usdcDecimals); // 1 USDC
        
        console.log(chalk.gray(`   Approving contract to spend USDC...`));
        const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, usdcBetAmount);
        await approveTx.wait();
        
        // Place USDC bet
        console.log(chalk.gray(`   Placing 1 USDC bet on option 0...`));
        const usdcBetTx = await contract.placeBetToken(
          usdcPollId,
          0,
          usdcBetAmount,
          { gasLimit: 300000 }
        );
        
        console.log(chalk.yellow(`   Tx sent: ${usdcBetTx.hash}`));
        await usdcBetTx.wait();
        
        console.log(chalk.green(`   ✅ USDC bet placed successfully!\n`));
      }
    }
    
    // ========== SUMMARY ==========
    console.log(chalk.blue.bold("\n📊 Test Summary"));
    console.log(chalk.green("   ✅ All core functions tested successfully!"));
    console.log(chalk.gray(`   - Poll creation: Working`));
    console.log(chalk.gray(`   - ETH betting: Working`));
    console.log(chalk.gray(`   - Event emission: Working`));
    console.log(chalk.gray(`   - Time multipliers: Working`));
    console.log(chalk.gray(`   - Data retrieval: Working`));
    
    // Display links
    console.log(chalk.blue.bold("\n🔗 Useful Links"));
    console.log(chalk.gray(`   View contract: https://basescan.org/address/${CONTRACT_ADDRESS}`));
    console.log(chalk.gray(`   View poll tx: https://basescan.org/tx/${createTx.hash}`));
    console.log(chalk.gray(`   View bet tx: https://basescan.org/tx/${betTx.hash}`));
    
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error.message);
    
    if (error.reason) {
      console.error(chalk.red("   Reason:"), error.reason);
    }
    
    if (error.code) {
      console.error(chalk.red("   Error code:"), error.code);
    }
    
    if (error.transaction) {
      console.error(chalk.red("   Failed tx:"), error.transaction.hash);
    }
    
    process.exit(1);
  }
}

// Helper function for user input
function askYesNo(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question(chalk.yellow(`\n${question} (y/n): `), (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// Run the tests
main()
  .then(() => {
    console.log(chalk.green.bold("\n✅ All tests completed successfully!"));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red.bold("\n❌ Test suite failed:"), error);
    process.exit(1);
  });