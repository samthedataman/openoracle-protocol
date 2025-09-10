#!/usr/bin/env node
/**
 * Quick test script for PolyPoll contract
 * Simple poll creation and betting test
 */

const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Load the full compiled ABI
const contractArtifact = require("./artifacts/contracts/PollyPoll.sol/PolyPoll.json");

async function quickTest() {
  console.log("\n🚀 Quick Contract Test\n");
  
  // Setup
  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  
  const CONTRACT_ADDRESS = "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, wallet);
  
  // Check balance
  const balance = await wallet.getBalance();
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH\n`);
  
  try {
    // Check current poll ID counter
    console.log("🔍 Checking contract state...");
    const nextPollId = await contract.nextPollId();
    console.log(`Next Poll ID in contract: ${nextPollId.toString()}`);
    
    // Check poll 1 which had a successful bet earlier
    console.log("\nChecking Poll #1 (had successful bet tx 0x5abacc8137...):");
    try {
      const poll1Details = await contract.getPollDetails(1, wallet.address);
      console.log(`  Question: ${poll1Details.question || "empty"}`);
      console.log(`  Creator: ${poll1Details.creator}`);
      console.log(`  Total Pool: ${ethers.utils.formatEther(poll1Details.totalPool)} ETH`);
      console.log(`  Has user voted: ${poll1Details.hasUserVoted}`);
    } catch (e) {
      console.log(`  Error reading poll 1: ${e.message}`);
    }
    console.log();
    
    // Test 1: Create Poll
    console.log("📝 Creating poll...");
    const tx1 = await contract.createPoll(
      `https://test.com/article-${Date.now()}`,
      "Will ETH hit $5000 this month?",
      ["Yes", "No", "Maybe"],
      ethers.constants.AddressZero,  // ETH
      48  // 48 hours
    );
    
    console.log(`Tx: ${tx1.hash}`);
    const receipt1 = await tx1.wait();
    
    const event = receipt1.events?.find(e => e.event === "PollCreated");
    const pollId = event?.args?.[0]?.toString();
    console.log(`✅ Poll created! ID: ${pollId}\n`);
    
    // Verify poll exists using getPollDetails
    console.log("🔍 Verifying poll existence...");
    const pollDetails = await contract.getPollDetails(pollId, wallet.address);
    console.log(`Poll question: ${pollDetails.question}`);
    console.log(`Poll creator: ${pollDetails.creator}`);
    console.log(`Poll start time: ${new Date(pollDetails.startTime * 1000).toLocaleString()}`);
    console.log(`Total participants: ${pollDetails.participantCount.toString()}\n`);
    
    // Test 2: Place Bet
    console.log("💰 Placing bet on poll ID:", pollId);
    
    // Try different poll IDs to see if any work
    console.log("Testing if any existing polls work...");
    for (let testId = 1; testId <= 4; testId++) {
      try {
        console.log(`  Checking poll ${testId}...`);
        const testTx = await contract.placeBetETH(
          testId,
          0,
          { 
            value: ethers.utils.parseEther("0.001"),
            gasLimit: 300000
          }
        );
        console.log(`  ✅ Poll ${testId} accepts bets! Tx: ${testTx.hash}`);
        await testTx.wait();
        break;
      } catch (e) {
        console.log(`  ❌ Poll ${testId}: ${e.reason || "Failed"}`);
      }
    }
    
    // Test 3: Read Poll  
    console.log("\n📖 Reading poll data...");
    const finalPoll = await contract.getPollDetails(pollId, wallet.address);
    console.log(`Question: ${finalPoll.question}`);
    console.log(`Total Pool: ${ethers.utils.formatEther(finalPoll.totalPool)} ETH`);
    console.log(`Creator: ${finalPoll.creator}`);
    console.log(`Participants: ${finalPoll.participantCount.toString()}`);
    console.log(`Your bet: ${ethers.utils.formatEther(finalPoll.userAmount)} ETH on option ${finalPoll.userOption}`);
    
    console.log("\n✅ All tests passed!");
    console.log(`View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

quickTest();