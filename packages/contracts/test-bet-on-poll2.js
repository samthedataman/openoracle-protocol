#!/usr/bin/env node
/**
 * Test betting on Poll #2 which is open
 */

const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const contractArtifact = require("./artifacts/contracts/PollyPoll.sol/PolyPoll.json");

async function testBetting() {
  console.log("\n💰 Testing Bet on Poll #2\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  
  const CONTRACT_ADDRESS = "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, wallet);
  
  console.log(`Wallet: ${wallet.address}`);
  const balance = await wallet.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH\n`);
  
  try {
    // Check Poll #2 status
    console.log("📊 Poll #2 Status:");
    const poll2 = await contract.getPollDetails(2, wallet.address);
    console.log(`Question: ${poll2.question}`);
    console.log(`Options: ${poll2.options.join(", ")}`);
    console.log(`Current Pool: ${ethers.utils.formatEther(poll2.totalPool)} ETH`);
    console.log(`Participants: ${poll2.participantCount.toString()}`);
    console.log(`Already voted: ${poll2.hasUserVoted}\n`);
    
    if (poll2.hasUserVoted) {
      console.log("You already voted on this poll!");
      return;
    }
    
    // Check time multiplier
    const multiplier = await contract.getCurrentMultiplier(2);
    console.log(`Current time multiplier: ${multiplier.toNumber() / 10000}x`);
    
    // Place bet
    console.log("\n💸 Placing bet on Poll #2...");
    console.log("Amount: 0.001 ETH");
    console.log("Option: 1 (No)");
    
    const betTx = await contract.placeBetETH(
      2,  // Poll ID 2
      1,  // Option 1 ("No")
      { 
        value: ethers.utils.parseEther("0.001"),
        gasLimit: 400000
      }
    );
    
    console.log(`\nTransaction sent: ${betTx.hash}`);
    console.log("Waiting for confirmation...");
    const receipt = await betTx.wait();
    
    console.log(`\n✅ Bet placed successfully!`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    // Check BetPlaced event
    const betEvent = receipt.events?.find(e => e.event === "BetPlaced");
    if (betEvent) {
      console.log(`\nBet Details:`);
      console.log(`  Poll ID: ${betEvent.args.pollId.toString()}`);
      console.log(`  Option: ${betEvent.args.option}`);
      console.log(`  Amount: ${ethers.utils.formatEther(betEvent.args.amount)} ETH`);
      console.log(`  Weighted Amount: ${ethers.utils.formatEther(betEvent.args.weightedAmount)} ETH`);
    }
    
    // Check updated poll status
    console.log("\n📊 Updated Poll #2 Status:");
    const updatedPoll = await contract.getPollDetails(2, wallet.address);
    console.log(`Total Pool: ${ethers.utils.formatEther(updatedPoll.totalPool)} ETH`);
    console.log(`Participants: ${updatedPoll.participantCount.toString()}`);
    console.log(`Your vote: Option ${updatedPoll.userOption} with ${ethers.utils.formatEther(updatedPoll.userAmount)} ETH`);
    
    // Show option breakdown
    console.log("\nOption Pools:");
    for (let i = 0; i < updatedPoll.options.length; i++) {
      const percentage = updatedPoll.optionPercentages[i].toNumber() / 100;
      console.log(`  ${updatedPoll.options[i]}: ${ethers.utils.formatEther(updatedPoll.optionPools[i])} ETH (${percentage}%)`);
    }
    
    console.log(`\n🔗 View transaction: https://basescan.org/tx/${betTx.hash}`);
    
  } catch (error) {
    console.error("\n❌ Error:", error.reason || error.message);
  }
}

testBetting();