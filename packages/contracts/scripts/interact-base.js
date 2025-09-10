// scripts/interact-base.js
// Interaction script for PollyPoll on Base network

const hre = require("hardhat");
const { ethers } = hre;

// Base Mainnet Token Addresses
const BASE_TOKENS = {
  ETH: "0x0000000000000000000000000000000000000000",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  PYUSD: "0xCaA940D48b22B8f3fb53b7d5EB0a0e43Bc261D3c",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
  WETH: "0x4200000000000000000000000000000000000006"
};

async function main() {
  const command = process.argv[2];
  
  // Get contract address from env or deployments
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("❌ CONTRACT_ADDRESS not set in .env file");
    console.log("Deploy the contract first using: npm run deploy:base-sepolia");
    process.exit(1);
  }
  
  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);
  
  const balance = await signer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  // Get contract instance
  const PollyPoll = await ethers.getContractFactory("PollyPoll");
  const pollyPoll = PollyPoll.attach(contractAddress);
  
  switch (command) {
    case "create-poll":
      await createPoll(pollyPoll);
      break;
    
    case "create-poll-usdc":
      await createPollUSDC(pollyPoll);
      break;
    
    case "create-poll-cbeth":
      await createPollCbETH(pollyPoll);
      break;
    
    case "place-bet":
      await placeBet(pollyPoll);
      break;
    
    case "resolve":
      await resolvePoll(pollyPoll);
      break;
    
    case "claim":
      await claimWinnings(pollyPoll);
      break;
    
    case "stats":
      await getStats(pollyPoll);
      break;
    
    case "poll-details":
      await getPollDetails(pollyPoll);
      break;
    
    case "user-stats":
      await getUserStats(pollyPoll, signer.address);
      break;
    
    default:
      console.log("Available commands:");
      console.log("  create-poll      - Create a poll accepting ETH");
      console.log("  create-poll-usdc - Create a poll accepting USDC");
      console.log("  create-poll-cbeth - Create a poll accepting cbETH");
      console.log("  place-bet        - Place a bet on a poll");
      console.log("  resolve          - Resolve a poll after it ends");
      console.log("  claim            - Claim winnings from a poll");
      console.log("  stats            - Get protocol statistics");
      console.log("  poll-details     - Get details of a specific poll");
      console.log("  user-stats       - Get your user statistics");
  }
}

async function createPoll(contract) {
  console.log("\n📝 Creating a poll accepting ETH...\n");
  
  const articleUrl = "https://www.coinbase.com/news/base-reaches-milestone";
  const question = "Will Base process over 10M transactions per day by Q2 2025?";
  const options = ["Yes, definitely", "No, too ambitious", "Maybe by Q3"];
  const paymentToken = BASE_TOKENS.ETH;
  const durationHours = 48; // 48 hours
  
  console.log("Poll Details:");
  console.log("  Article:", articleUrl);
  console.log("  Question:", question);
  console.log("  Options:", options);
  console.log("  Payment Token: ETH");
  console.log("  Duration:", durationHours, "hours");
  
  const tx = await contract.createPoll(
    articleUrl,
    question,
    options,
    paymentToken,
    durationHours
  );
  
  console.log("\n⏳ Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  
  const event = receipt.events.find(e => e.event === "PollCreated");
  const pollId = event.args.pollId;
  
  console.log("✅ Poll created successfully!");
  console.log("   Poll ID:", pollId.toString());
  console.log("   Gas used:", receipt.gasUsed.toString());
  
  const networkName = hre.network.name;
  const explorer = networkName === "baseMainnet" 
    ? "https://basescan.org" 
    : "https://sepolia.basescan.org";
  
  console.log("   View on Basescan:", `${explorer}/tx/${tx.hash}`);
  
  return pollId;
}

async function createPollUSDC(contract) {
  console.log("\n📝 Creating a poll accepting USDC...\n");
  
  const articleUrl = "https://www.circle.com/en/usdc";
  const question = "Will USDC on Base exceed $1B in circulation?";
  const options = ["Yes", "No"];
  const paymentToken = BASE_TOKENS.USDC;
  const durationHours = 72; // 72 hours
  
  console.log("Poll Details:");
  console.log("  Article:", articleUrl);
  console.log("  Question:", question);
  console.log("  Options:", options);
  console.log("  Payment Token: USDC");
  console.log("  Duration:", durationHours, "hours");
  
  const tx = await contract.createPoll(
    articleUrl,
    question,
    options,
    paymentToken,
    durationHours
  );
  
  console.log("\n⏳ Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  
  const event = receipt.events.find(e => e.event === "PollCreated");
  const pollId = event.args.pollId;
  
  console.log("✅ Poll created successfully!");
  console.log("   Poll ID:", pollId.toString());
  console.log("   Accepts: USDC");
  
  return pollId;
}

async function createPollCbETH(contract) {
  console.log("\n📝 Creating a poll accepting cbETH...\n");
  
  const articleUrl = "https://www.coinbase.com/cbeth";
  const question = "Will cbETH staking APR stay above 3%?";
  const options = ["Yes", "No", "Will fluctuate"];
  const paymentToken = BASE_TOKENS.cbETH;
  const durationHours = 24; // 24 hours
  
  const tx = await contract.createPoll(
    articleUrl,
    question,
    options,
    paymentToken,
    durationHours
  );
  
  const receipt = await tx.wait();
  const event = receipt.events.find(e => e.event === "PollCreated");
  
  console.log("✅ Poll created!");
  console.log("   Poll ID:", event.args.pollId.toString());
  console.log("   Accepts: cbETH (Coinbase Staked ETH)");
}

async function placeBet(contract) {
  const pollId = process.argv[3];
  const optionIndex = process.argv[4];
  const amountInEth = process.argv[5] || "0.001";
  
  if (!pollId || optionIndex === undefined) {
    console.log("Usage: npm run interact place-bet <pollId> <optionIndex> [amount]");
    console.log("Example: npm run interact place-bet 1 0 0.01");
    return;
  }
  
  console.log(`\n💰 Placing bet on Poll #${pollId}...`);
  
  // Get poll details first
  const [signer] = await ethers.getSigners();
  const pollDetails = await contract.getPollDetails(pollId, signer.address);
  
  if (pollDetails.hasUserVoted) {
    console.log("❌ You have already voted in this poll!");
    return;
  }
  
  console.log("Poll:", pollDetails.question);
  console.log("Options:");
  pollDetails.options.forEach((option, index) => {
    const percentage = pollDetails.optionPercentages[index];
    console.log(`  ${index}: ${option} (${percentage.div(100)}% of pool)`);
  });
  
  console.log(`\nYour choice: Option ${optionIndex} - "${pollDetails.options[optionIndex]}"`);
  console.log(`Bet amount: ${amountInEth} ETH`);
  
  // Get current multiplier
  const multiplier = await contract.getCurrentMultiplier(pollId);
  console.log(`Current multiplier: ${multiplier / 10000}x`);
  
  // Place bet based on token type
  let tx;
  if (pollDetails.paymentToken === BASE_TOKENS.ETH) {
    tx = await contract.placeBetETH(pollId, optionIndex, {
      value: ethers.utils.parseEther(amountInEth)
    });
  } else {
    console.log("❌ This poll accepts a different token. Use appropriate betting function.");
    return;
  }
  
  console.log("\n⏳ Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  
  console.log("✅ Bet placed successfully!");
  console.log("   Gas used:", receipt.gasUsed.toString());
  
  const betEvent = receipt.events.find(e => e.event === "BetPlaced");
  if (betEvent) {
    console.log("   Weighted amount:", ethers.utils.formatEther(betEvent.args.weightedAmount));
  }
}

async function resolvePoll(contract) {
  const pollId = process.argv[3];
  
  if (!pollId) {
    console.log("Usage: npm run interact resolve <pollId>");
    return;
  }
  
  console.log(`\n🔨 Resolving Poll #${pollId}...`);
  
  const tx = await contract.resolvePoll(pollId);
  console.log("⏳ Transaction sent:", tx.hash);
  
  const receipt = await tx.wait();
  
  const resolveEvent = receipt.events.find(e => e.event === "PollResolved");
  if (resolveEvent) {
    console.log("✅ Poll resolved!");
    console.log("   Winning option:", resolveEvent.args.winningOption.toString());
    console.log("   Total pool:", ethers.utils.formatEther(resolveEvent.args.totalPool), "ETH");
    console.log("   Platform fee:", ethers.utils.formatEther(resolveEvent.args.platformFee), "ETH");
  }
  
  const tieEvent = receipt.events.find(e => e.event === "TieResolved");
  if (tieEvent) {
    console.log("   ⚠️  Tie was resolved by:", tieEvent.args.method);
  }
}

async function claimWinnings(contract) {
  const pollId = process.argv[3];
  
  if (!pollId) {
    console.log("Usage: npm run interact claim <pollId>");
    return;
  }
  
  console.log(`\n💸 Claiming winnings from Poll #${pollId}...`);
  
  const tx = await contract.claimWinnings(pollId);
  console.log("⏳ Transaction sent:", tx.hash);
  
  const receipt = await tx.wait();
  
  const claimEvent = receipt.events.find(e => e.event === "WinningsClaimed");
  if (claimEvent) {
    console.log("✅ Winnings claimed!");
    console.log("   Amount:", ethers.utils.formatEther(claimEvent.args.amount), "ETH");
  } else {
    console.log("No winnings to claim (you may have lost or already claimed)");
  }
}

async function getStats(contract) {
  console.log("\n📊 Protocol Statistics\n");
  
  const stats = await contract.getProtocolStats();
  
  console.log("Total Polls Created:", stats.totalPolls.toString());
  console.log("Total Bets Placed:", stats.totalBets.toString());
  console.log("Total Volume:", ethers.utils.formatEther(stats.totalVolume), "ETH equivalent");
  console.log("Active Polls:", stats.activePollsCount.toString());
  
  // Get token-specific volumes
  console.log("\n💰 Token Volumes:");
  
  const ethVolume = await contract.getTokenVolume(BASE_TOKENS.ETH);
  console.log("  ETH:", ethers.utils.formatEther(ethVolume), "ETH");
  
  const usdcVolume = await contract.getTokenVolume(BASE_TOKENS.USDC);
  console.log("  USDC:", (usdcVolume / 1e6).toFixed(2), "USDC");
  
  const cbethVolume = await contract.getTokenVolume(BASE_TOKENS.cbETH);
  console.log("  cbETH:", ethers.utils.formatEther(cbethVolume), "cbETH");
}

async function getPollDetails(contract) {
  const pollId = process.argv[3];
  
  if (!pollId) {
    console.log("Usage: npm run interact poll-details <pollId>");
    return;
  }
  
  const [signer] = await ethers.getSigners();
  const poll = await contract.getPollDetails(pollId, signer.address);
  
  console.log(`\n📋 Poll #${pollId} Details\n`);
  console.log("Article:", poll.articleUrl);
  console.log("Question:", poll.question);
  console.log("Creator:", poll.creator);
  console.log("Token:", poll.tokenSymbol);
  console.log("Status:", poll.resolved ? "Resolved" : "Active");
  
  if (poll.wasCancelled) {
    console.log("⚠️  Poll was cancelled");
  }
  if (poll.wasRefunded) {
    console.log("⚠️  Poll was refunded (single participant)");
  }
  
  console.log("\nOptions:");
  poll.options.forEach((option, index) => {
    const pool = ethers.utils.formatEther(poll.optionPools[index]);
    const percentage = poll.optionPercentages[index];
    const marker = poll.resolved && poll.winningOption == index ? " ✅ WINNER" : "";
    console.log(`  ${index}: ${option} - ${pool} ${poll.tokenSymbol} (${percentage.div(100)}%)${marker}`);
  });
  
  console.log("\nTotal Pool:", ethers.utils.formatEther(poll.totalPool), poll.tokenSymbol);
  console.log("Participants:", poll.participantCount.toString());
  
  const startDate = new Date(poll.startTime.toNumber() * 1000);
  const endDate = new Date(poll.endTime.toNumber() * 1000);
  console.log("Start:", startDate.toLocaleString());
  console.log("End:", endDate.toLocaleString());
  
  if (poll.hasUserVoted) {
    console.log("\n👤 Your Bet:");
    console.log("  Option:", poll.userOption, "-", poll.options[poll.userOption]);
    console.log("  Amount:", ethers.utils.formatEther(poll.userAmount), poll.tokenSymbol);
  }
}

async function getUserStats(contract, userAddress) {
  console.log(`\n👤 User Statistics for ${userAddress}\n`);
  
  const stats = await contract.getUserStats(userAddress);
  
  console.log("Total Bets Placed:", ethers.utils.formatEther(stats.totalBets), "ETH equivalent");
  console.log("Total Winnings:", ethers.utils.formatEther(stats.totalWinnings), "ETH equivalent");
  console.log("Polls Participated:", stats.totalPolls.toString());
  
  if (stats.userPollIds.length > 0) {
    console.log("\nRecent Poll IDs:", stats.userPollIds.slice(-5).join(", "));
  }
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });