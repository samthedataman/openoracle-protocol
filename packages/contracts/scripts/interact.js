// scripts/interact.js
// Interaction scripts for testing PollyPoll on Base

const { ethers } = require("hardhat");

// Base Token Addresses
const BASE_TOKENS = {
  ETH: "0x0000000000000000000000000000000000000000",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  PYUSD: "0xCaA940D48b22B8f3fb53b7d5EB0a0e43Bc261D3c",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"
};

async function createPoll() {
  // Try to get contract from deployments or use env variable
  let contractAddress;
  try {
    const deployment = require(`../deployments/${network.name}-deployment.json`);
    contractAddress = deployment.pollyPoll;
  } catch (e) {
    contractAddress = process.env.CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error("Contract not deployed. Run 'npm run deploy:base-sepolia' first.");
    }
  }
  
  const pollyPoll = await ethers.getContractAt("PollyPoll", contractAddress);
  
  const articleUrl = "https://www.coinbase.com/news/base-ecosystem-growth";
  const question = "Will Base TVL exceed $10B by end of 2025?";
  const options = [
    "Yes, definitely",
    "Possibly", 
    "Unlikely"
  ];
  const paymentToken = BASE_TOKENS.ETH; // Accept ETH
  const durationHours = 48; // 48 hours
  
  console.log("Creating poll on Base...");
  console.log("  Question:", question);
  console.log("  Duration:", durationHours, "hours");
  console.log("  Payment Token: ETH");
  
  const tx = await pollyPoll.createPoll(articleUrl, question, options, paymentToken, durationHours);
  const receipt = await tx.wait();
  
  // Get poll ID from events
  const event = receipt.events.find(e => e.event === "PollCreated");
  const pollId = event.args.pollId;
  
  console.log("✅ Poll created with ID:", pollId.toString());
  console.log("   Transaction hash:", tx.hash);
  
  return pollId;
}

async function placeBet(pollId, option, amount) {
  // Get contract address
  let contractAddress;
  try {
    const deployment = require(`../deployments/${network.name}-deployment.json`);
    contractAddress = deployment.pollyPoll;
  } catch (e) {
    contractAddress = process.env.CONTRACT_ADDRESS;
  }
  
  const pollyPoll = await ethers.getContractAt("PollyPoll", contractAddress);
  
  // Get poll details to check payment token
  const [signer] = await ethers.getSigners();
  const pollDetails = await pollyPoll.getPollDetails(pollId, signer.address);
  
  console.log(`Placing bet on poll ${pollId}, option ${option} with ${amount} ETH...`);
  
  let tx;
  if (pollDetails.paymentToken === BASE_TOKENS.ETH) {
    // ETH bet
    tx = await pollyPoll.placeBetETH(pollId, option, {
      value: ethers.utils.parseEther(amount.toString())
    });
  } else {
    // ERC20 token bet
    const tokenAmount = pollDetails.paymentToken === BASE_TOKENS.cbETH 
      ? ethers.utils.parseEther(amount.toString())
      : ethers.utils.parseUnits(amount.toString(), 6); // USDC/PYUSD have 6 decimals
    
    tx = await pollyPoll.placeBetToken(pollId, option, tokenAmount);
  }
  
  const receipt = await tx.wait();
  console.log("✅ Bet placed successfully on Base!");
  console.log("   Transaction hash:", tx.hash);
  
  // Get bet details from event
  const event = receipt.events.find(e => e.event === "BetPlaced");
  console.log("   Weighted amount:", ethers.utils.formatEther(event.args.weightedAmount));
}

async function getPollDetails(pollId) {
  let contractAddress;
  try {
    const deployment = require(`../deployments/${network.name}-deployment.json`);
    contractAddress = deployment.pollyPoll;
  } catch (e) {
    contractAddress = process.env.CONTRACT_ADDRESS;
  }
  
  const pollyPoll = await ethers.getContractAt("PollyPoll", contractAddress);
  
  const [signer] = await ethers.getSigners();
  const details = await pollyPoll.getPollDetails(pollId, signer.address);
  
  console.log("\n📊 Poll Details on Base:");
  console.log("   Question:", details.question);
  console.log("   Article:", details.articleUrl);
  console.log("   Token:", details.tokenSymbol);
  console.log("   Total Pool:", ethers.utils.formatEther(details.totalPool), details.tokenSymbol);
  console.log("   Status:", details.resolved ? "Resolved" : "Active");
  console.log("   Participants:", details.participantCount.toString());
  
  console.log("\n   Options:");
  for (let i = 0; i < details.options.length; i++) {
    const percentage = details.optionPercentages[i].div(100);
    const poolAmount = details.tokenSymbol === "USDC" || details.tokenSymbol === "PYUSD"
      ? (details.optionPools[i] / 1e6).toFixed(2)
      : ethers.utils.formatEther(details.optionPools[i]);
    console.log(`   ${i}. ${details.options[i]}: ${poolAmount} ${details.tokenSymbol} (${percentage}%)`);
  }
  
  if (details.hasUserVoted) {
    console.log("\n   Your Vote:");
    console.log(`   Option: ${details.options[details.userOption]}`);
    const userAmount = details.tokenSymbol === "USDC" || details.tokenSymbol === "PYUSD"
      ? (details.userAmount / 1e6).toFixed(2)
      : ethers.utils.formatEther(details.userAmount);
    console.log(`   Amount: ${userAmount} ${details.tokenSymbol}`);
  }
}

async function resolvePoll(pollId) {
  let contractAddress;
  try {
    const deployment = require(`../deployments/${network.name}-deployment.json`);
    contractAddress = deployment.pollyPoll;
  } catch (e) {
    contractAddress = process.env.CONTRACT_ADDRESS;
  }
  
  const pollyPoll = await ethers.getContractAt("PollyPoll", contractAddress);
  
  console.log(`Resolving poll ${pollId}...`);
  const tx = await pollyPoll.resolvePoll(pollId);
  const receipt = await tx.wait();
  
  const event = receipt.events.find(e => e.event === "PollResolved");
  console.log("✅ Poll resolved!");
  console.log("   Winning option:", event.args.winningOption.toString());
  console.log("   Total pool:", ethers.utils.formatEther(event.args.totalPool));
  console.log("   Platform fee:", ethers.utils.formatEther(event.args.platformFee));
}

async function claimWinnings(pollId) {
  let contractAddress;
  try {
    const deployment = require(`../deployments/${network.name}-deployment.json`);
    contractAddress = deployment.pollyPoll;
  } catch (e) {
    contractAddress = process.env.CONTRACT_ADDRESS;
  }
  
  const pollyPoll = await ethers.getContractAt("PollyPoll", contractAddress);
  
  console.log(`Claiming winnings from poll ${pollId}...`);
  const tx = await pollyPoll.claimWinnings(pollId);
  const receipt = await tx.wait();
  
  const event = receipt.events.find(e => e.event === "WinningsClaimed");
  if (event) {
    console.log("✅ Winnings claimed!");
    console.log("   Amount:", ethers.utils.formatEther(event.args.amount));
  } else {
    console.log("❌ No winnings to claim (you didn't win)");
  }
}

async function getCurrentMultiplier(pollId) {
  let contractAddress;
  try {
    const deployment = require(`../deployments/${network.name}-deployment.json`);
    contractAddress = deployment.pollyPoll;
  } catch (e) {
    contractAddress = process.env.CONTRACT_ADDRESS;
  }
  
  const pollyPoll = await ethers.getContractAt("PollyPoll", contractAddress);
  
  const multiplier = await pollyPoll.getCurrentMultiplier(pollId);
  const multiplierValue = multiplier.toNumber() / 10000;
  
  console.log(`Current time bonus multiplier for poll ${pollId}: ${multiplierValue}x`);
  
  if (multiplierValue === 1.5) {
    console.log("🚀 Early bird bonus active! (First 10% of poll duration)");
  } else if (multiplierValue === 1.3) {
    console.log("⚡ Quick bonus active! (10-30% of poll duration)");
  } else if (multiplierValue === 1.1) {
    console.log("⏰ Normal bonus active! (30-60% of poll duration)");
  } else {
    console.log("📊 Base multiplier (After 60% of poll duration)");
  }
  
  return multiplierValue;
}

// Export functions for use in other scripts
module.exports = {
  createPoll,
  placeBet,
  getPollDetails,
  resolvePoll,
  claimWinnings,
  getCurrentMultiplier
};

// If running directly, execute based on command line args
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  const commands = {
    create: createPoll,
    bet: () => placeBet(args[0], args[1], args[2]),
    details: () => getPollDetails(args[0]),
    resolve: () => resolvePoll(args[0]),
    claim: () => claimWinnings(args[0]),
    multiplier: () => getCurrentMultiplier(args[0])
  };
  
  if (commands[command]) {
    commands[command]()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  } else {
    console.log("Usage:");
    console.log("  npx hardhat run scripts/interact.js --network baseSepolia create");
    console.log("  npx hardhat run scripts/interact.js --network baseSepolia bet <pollId> <option> <amount>");
    console.log("  npx hardhat run scripts/interact.js --network baseSepolia details <pollId>");
    console.log("  npx hardhat run scripts/interact.js --network baseSepolia resolve <pollId>");
    console.log("  npx hardhat run scripts/interact.js --network baseSepolia claim <pollId>");
    console.log("  npx hardhat run scripts/interact.js --network baseSepolia multiplier <pollId>");
  }
}