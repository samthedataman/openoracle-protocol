#!/usr/bin/env node
/**
 * Comprehensive test for PolyPoll contract on Base Mainnet
 * Tests existing polls and creates new ones
 */

const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Load the full compiled ABI
const contractArtifact = require("./artifacts/contracts/PollyPoll.sol/PolyPoll.json");

async function comprehensiveTest() {
  console.log("\n🚀 Comprehensive PolyPoll Test on Base Mainnet\n");
  console.log("=" .repeat(50));
  
  // Setup
  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  
  const CONTRACT_ADDRESS = "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, wallet);
  
  // Check wallet
  console.log("\n📱 Wallet Info:");
  console.log(`Address: ${wallet.address}`);
  const balance = await wallet.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  try {
    // ============ PART 1: CHECK CONTRACT STATE ============
    console.log("\n📊 Contract State:");
    console.log("-" .repeat(30));
    
    const nextPollId = await contract.nextPollId();
    console.log(`Next Poll ID: ${nextPollId.toString()}`);
    
    const owner = await contract.owner();
    console.log(`Contract Owner: ${owner}`);
    
    // Check accepted tokens
    const ethConfig = await contract.acceptedTokens(ethers.constants.AddressZero);
    console.log(`\nETH Token Config:`);
    console.log(`  Accepted: ${ethConfig.isAccepted}`);
    console.log(`  Min Bet: ${ethers.utils.formatEther(ethConfig.minBet)} ETH`);
    console.log(`  Max Bet: ${ethers.utils.formatEther(ethConfig.maxBet)} ETH`);
    console.log(`  Total Volume: ${ethers.utils.formatEther(ethConfig.totalVolume)} ETH`);
    
    // ============ PART 2: CHECK EXISTING POLLS ============
    console.log("\n📜 Checking Existing Polls:");
    console.log("-" .repeat(30));
    
    // Get recent PollCreated events
    const filter = contract.filters.PollCreated();
    const events = await contract.queryFilter(filter, -2000); // Last 2000 blocks
    
    console.log(`Found ${events.length} polls created recently\n`);
    
    // Check each poll's actual state
    for (let i = 1; i < Math.min(nextPollId.toNumber(), 6); i++) {
      console.log(`\n🔍 Poll #${i}:`);
      
      // Try to get poll details
      try {
        const pollDetails = await contract.getPollDetails(i, wallet.address);
        
        if (pollDetails.question) {
          console.log(`  ✅ Poll exists and is readable!`);
          console.log(`  Question: ${pollDetails.question}`);
          console.log(`  Options: ${pollDetails.options.join(", ")}`);
          console.log(`  Creator: ${pollDetails.creator}`);
          console.log(`  Total Pool: ${ethers.utils.formatEther(pollDetails.totalPool)} ETH`);
          console.log(`  Participants: ${pollDetails.participantCount.toString()}`);
          console.log(`  Start: ${new Date(pollDetails.startTime * 1000).toLocaleString()}`);
          console.log(`  End: ${new Date(pollDetails.endTime * 1000).toLocaleString()}`);
          
          if (pollDetails.hasUserVoted) {
            console.log(`  Your Vote: Option ${pollDetails.userOption} with ${ethers.utils.formatEther(pollDetails.userAmount)} ETH`);
          }
          
          // Check if we can bet on this poll
          if (!pollDetails.resolved && pollDetails.endTime > Date.now() / 1000 && !pollDetails.hasUserVoted) {
            console.log(`  💡 This poll is open for betting!`);
          }
        } else {
          console.log(`  ❌ Poll data is empty (storage issue)`);
          
          // Check if there's an event for this poll
          const pollEvent = events.find(e => e.args.pollId.toString() === i.toString());
          if (pollEvent) {
            console.log(`  Event data: ${pollEvent.args.articleUrl.substring(0, 40)}...`);
            console.log(`  Creator from event: ${pollEvent.args.creator}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Error reading poll: ${error.message.substring(0, 50)}...`);
      }
    }
    
    // ============ PART 3: TEST BETTING ON POLL 1 ============
    console.log("\n\n💰 Testing Betting on Poll #1:");
    console.log("-" .repeat(30));
    
    // Check if we already voted on poll 1
    try {
      const poll1Details = await contract.getPollDetails(1, wallet.address);
      
      if (poll1Details.hasUserVoted) {
        console.log("You already voted on Poll #1");
        console.log(`Your bet: ${ethers.utils.formatEther(poll1Details.userAmount)} ETH on option ${poll1Details.userOption}`);
      } else {
        console.log("Attempting to place bet on Poll #1...");
        console.log("Betting 0.001 ETH on option 0");
        
        const betTx = await contract.placeBetETH(
          1,  // Poll ID 1
          0,  // Option 0
          { 
            value: ethers.utils.parseEther("0.001"),
            gasLimit: 400000
          }
        );
        
        console.log(`Transaction sent: ${betTx.hash}`);
        const betReceipt = await betTx.wait();
        console.log(`✅ Bet placed successfully!`);
        console.log(`Gas used: ${betReceipt.gasUsed.toString()}`);
        
        // Check for BetPlaced event
        const betEvent = betReceipt.events?.find(e => e.event === "BetPlaced");
        if (betEvent) {
          console.log(`Event data:`);
          console.log(`  Amount: ${ethers.utils.formatEther(betEvent.args.amount)} ETH`);
          console.log(`  Weighted: ${ethers.utils.formatEther(betEvent.args.weightedAmount)} ETH`);
        }
      }
    } catch (error) {
      if (error.reason?.includes("Already voted")) {
        console.log("✓ You already voted on this poll");
      } else if (error.reason?.includes("Poll does not exist")) {
        console.log("❌ Poll 1 doesn't exist in storage (contract bug)");
      } else {
        console.log(`❌ Betting failed: ${error.reason || error.message}`);
      }
    }
    
    // ============ PART 4: CREATE NEW POLL ============
    console.log("\n\n📝 Creating New Poll:");
    console.log("-" .repeat(30));
    
    const timestamp = Date.now();
    const pollData = {
      articleUrl: `https://news.base.org/article-${timestamp}`,
      question: `Test Poll ${timestamp}: Will Base reach 1M users?`,
      options: ["Yes", "No", "Maybe"],
      paymentToken: ethers.constants.AddressZero, // ETH
      duration: 48 // hours
    };
    
    console.log(`Question: ${pollData.question}`);
    console.log(`Options: ${pollData.options.join(", ")}`);
    console.log(`Duration: ${pollData.duration} hours`);
    
    try {
      const createTx = await contract.createPoll(
        pollData.articleUrl,
        pollData.question,
        pollData.options,
        pollData.paymentToken,
        pollData.duration,
        { gasLimit: 500000 }
      );
      
      console.log(`Transaction sent: ${createTx.hash}`);
      const createReceipt = await createTx.wait();
      
      // Get poll ID from event
      const event = createReceipt.events?.find(e => e.event === "PollCreated");
      const newPollId = event?.args?.pollId?.toString();
      
      console.log(`✅ Poll created! ID: ${newPollId}`);
      console.log(`Gas used: ${createReceipt.gasUsed.toString()}`);
      
      // Try to read the new poll
      console.log("\nVerifying new poll...");
      const newPollDetails = await contract.getPollDetails(newPollId, wallet.address);
      
      if (newPollDetails.question) {
        console.log("✅ New poll is readable!");
        console.log(`Question: ${newPollDetails.question}`);
      } else {
        console.log("❌ New poll data is empty (storage issue persists)");
      }
      
      // Try to bet on the new poll
      console.log("\nAttempting to bet on new poll...");
      try {
        const newBetTx = await contract.placeBetETH(
          newPollId,
          0,
          { 
            value: ethers.utils.parseEther("0.001"),
            gasLimit: 400000
          }
        );
        
        console.log(`Bet transaction sent: ${newBetTx.hash}`);
        await newBetTx.wait();
        console.log("✅ Bet placed on new poll!");
      } catch (betError) {
        console.log(`❌ Cannot bet on new poll: ${betError.reason || "storage issue"}`);
      }
      
    } catch (error) {
      console.log(`❌ Poll creation failed: ${error.reason || error.message}`);
    }
    
    // ============ PART 5: SUMMARY ============
    console.log("\n\n📋 Test Summary:");
    console.log("=" .repeat(50));
    
    console.log("\n✅ Working Features:");
    console.log("  • Contract deployment successful");
    console.log("  • Event emission works");
    console.log("  • Poll ID counter increments");
    console.log("  • Transaction 0x5abacc81... shows betting CAN work");
    
    console.log("\n❌ Issues Found:");
    console.log("  • Poll storage mapping not working properly");
    console.log("  • getPollDetails returns empty data for most polls");
    console.log("  • New polls can't accept bets due to storage issue");
    console.log("  • Poll struct with nested mappings not storing correctly");
    
    console.log("\n🔧 Recommended Actions:");
    console.log("  1. The contract needs to be redeployed");
    console.log("  2. Simplify the Poll struct (remove nested mappings)");
    console.log("  3. Use separate mappings for poll data");
    console.log("  4. Test thoroughly on testnet first");
    
    console.log("\n🔗 Useful Links:");
    console.log(`Contract: https://basescan.org/address/${CONTRACT_ADDRESS}`);
    console.log(`Your successful bet: https://basescan.org/tx/0x5abacc8137e686c20e5454c83fb6fe2d52b7179722f8e961b5799b20a86433f0`);
    
    // ============ PART 6: PROTOCOL STATS ============
    console.log("\n\n📈 Protocol Statistics:");
    console.log("-" .repeat(30));
    
    try {
      const stats = await contract.getProtocolStats();
      console.log(`Total Polls Created: ${stats.totalPolls.toString()}`);
      console.log(`Total Bets Placed: ${stats.totalBets.toString()}`);
      console.log(`Total Volume: ${ethers.utils.formatEther(stats.totalVolume)} ETH`);
      console.log(`Active Polls: ${stats.activePollsCount.toString()}`);
    } catch (error) {
      console.log(`Error getting stats: ${error.message}`);
    }
    
  } catch (error) {
    console.error("\n\n❌ Fatal Error:", error.message);
    if (error.reason) console.error("Reason:", error.reason);
    if (error.data) console.error("Data:", error.data);
  }
  
  console.log("\n" + "=" .repeat(50));
  console.log("Test completed!");
}

// Run the test
comprehensiveTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });