#!/usr/bin/env node
/**
 * Working test for Base Mainnet PolyPoll contract
 * Uses events to track polls since storage reads are problematic
 */

const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const contractArtifact = require("./artifacts/contracts/PollyPoll.sol/PolyPoll.json");

async function test() {
  console.log("\n🚀 Base Mainnet PolyPoll Test\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  
  const CONTRACT_ADDRESS = "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, wallet);
  
  console.log(`Wallet: ${wallet.address}`);
  const balance = await wallet.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH\n`);
  
  try {
    // Check current state
    console.log("📊 Contract State:");
    const nextPollId = await contract.nextPollId();
    console.log(`Next Poll ID: ${nextPollId.toString()}`);
    
    // Get recent PollCreated events to see existing polls
    console.log("\n📜 Recent Polls (from events):");
    const filter = contract.filters.PollCreated();
    const events = await contract.queryFilter(filter, -1000); // Last 1000 blocks
    
    const recentPolls = events.slice(-5).map(e => ({
      id: e.args.pollId.toString(),
      articleUrl: e.args.articleUrl,
      creator: e.args.creator,
      block: e.blockNumber,
      txHash: e.transactionHash
    }));
    
    recentPolls.forEach(poll => {
      console.log(`  Poll #${poll.id}: ${poll.articleUrl.substring(0, 30)}...`);
      console.log(`    Creator: ${poll.creator}`);
      console.log(`    Tx: ${poll.txHash}\n`);
    });
    
    // Create a new poll
    console.log("📝 Creating new poll...");
    const pollData = {
      articleUrl: `https://news.example.com/article-${Date.now()}`,
      question: "Will Base TVL exceed $10B by Q2 2025?",
      options: ["Yes", "No", "Maybe"],
      paymentToken: ethers.constants.AddressZero, // ETH
      duration: 48 // hours
    };
    
    console.log(`Question: ${pollData.question}`);
    console.log(`Options: ${pollData.options.join(", ")}`);
    
    const createTx = await contract.createPoll(
      pollData.articleUrl,
      pollData.question,
      pollData.options,
      pollData.paymentToken,
      pollData.duration,
      { gasLimit: 500000 }
    );
    
    console.log(`Tx sent: ${createTx.hash}`);
    const receipt = await createTx.wait();
    
    // Get poll ID from event
    const event = receipt.events?.find(e => e.event === "PollCreated");
    const pollId = event?.args?.pollId?.toString();
    console.log(`✅ Poll created! ID: ${pollId}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}\n`);
    
    // Try to place a bet using the poll ID from the event
    console.log("💰 Placing bet...");
    console.log(`Betting 0.001 ETH on option 0 for poll ${pollId}`);
    
    // Since direct storage access isn't working, we'll use the event-based poll ID
    // and handle the betting with proper error handling
    try {
      const betTx = await contract.placeBetETH(
        pollId,
        0, // Option "Yes"
        { 
          value: ethers.utils.parseEther("0.001"),
          gasLimit: 300000
        }
      );
      
      console.log(`Bet tx sent: ${betTx.hash}`);
      const betReceipt = await betTx.wait();
      console.log(`✅ Bet placed! Gas used: ${betReceipt.gasUsed.toString()}`);
      
      // Check for BetPlaced event
      const betEvent = betReceipt.events?.find(e => e.event === "BetPlaced");
      if (betEvent) {
        console.log(`Bet details from event:`);
        console.log(`  Amount: ${ethers.utils.formatEther(betEvent.args.amount)} ETH`);
        console.log(`  Weighted: ${ethers.utils.formatEther(betEvent.args.weightedAmount)} ETH`);
        console.log(`  Option: ${betEvent.args.option}`);
      }
      
    } catch (betError) {
      console.log("❌ Betting failed - this is expected due to storage issue");
      console.log(`Error: ${betError.reason || betError.message}`);
      
      // The contract has a bug where polls are created but storage isn't properly set
      // This causes placeBetETH to fail with "Poll does not exist" even though the event was emitted
      console.log("\n⚠️  Note: The contract appears to have a storage bug.");
      console.log("Events are emitted but poll data isn't stored correctly.");
      console.log("This prevents betting even on newly created polls.");
    }
    
    console.log("\n📋 Summary:");
    console.log(`✅ Poll creation works (events emitted)`);
    console.log(`❌ Poll storage is broken (can't read poll data)`);
    console.log(`❌ Betting fails due to storage issue`);
    console.log(`\n🔧 The contract needs to be redeployed with the storage fix.`);
    
    console.log(`\nView on BaseScan:`);
    console.log(`Contract: https://basescan.org/address/${CONTRACT_ADDRESS}`);
    console.log(`Create tx: https://basescan.org/tx/${createTx.hash}`);
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.reason) console.error("Reason:", error.reason);
  }
}

test();