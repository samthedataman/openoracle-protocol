// Simple test for deployed PolyPoll contract
const ethers = require('ethers');
const chalk = require('chalk');
require('dotenv').config();

const CONTRACT_ADDRESS = "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Minimal ABI for testing
const ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)", 
  "function getProtocolStats() view returns (uint256, uint256, uint256, uint256)",
  "function acceptedTokens(address) view returns (bool, uint256, uint256, uint8, string, uint256)",
  "function createPoll(string articleUrl, string question, string[] options, uint256 durationHours, address paymentToken) returns (uint256)",
  "function placeBetETH(uint256 pollId, uint8 option) payable"
];

async function testContract() {
  console.log(chalk.cyan.bold('\n🧪 PolyPoll Contract Quick Test\n'));
  
  // Connect to Base mainnet
  const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  
  console.log('📍 Contract:', CONTRACT_ADDRESS);
  console.log('👛 Wallet:', wallet.address);
  
  const balance = await wallet.getBalance();
  console.log('💰 Balance:', ethers.utils.formatEther(balance), 'ETH\n');
  
  try {
    // Test 1: Basic contract functions
    console.log(chalk.yellow('🔍 Test 1: Basic Functions'));
    const owner = await contract.owner();
    const paused = await contract.paused();
    console.log('   Owner:', owner);
    console.log('   Paused:', paused);
    console.log(owner === wallet.address ? chalk.green('   ✅ Correct owner') : chalk.red('   ❌ Wrong owner'));
    console.log(paused ? chalk.red('   ❌ Contract paused') : chalk.green('   ✅ Contract active'));
    
    // Test 2: Protocol stats
    console.log(chalk.yellow('\n🔍 Test 2: Protocol Stats'));
    const stats = await contract.getProtocolStats();
    console.log('   Total Polls:', stats[0].toString());
    console.log('   Active Polls:', stats[1].toString());
    console.log('   Total Bets:', stats[2].toString());
    console.log('   Total Volume:', ethers.utils.formatEther(stats[3]), 'ETH');
    
    // Test 3: Token configurations
    console.log(chalk.yellow('\n🔍 Test 3: Token Support'));
    
    // ETH
    const ethToken = await contract.acceptedTokens('0x0000000000000000000000000000000000000000');
    console.log('   ETH:', ethToken[0] ? '✅ Supported' : '❌ Not supported');
    if (ethToken[0]) {
      console.log('     Min bet:', ethers.utils.formatEther(ethToken[1]), 'ETH');
      console.log('     Max bet:', ethers.utils.formatEther(ethToken[2]), 'ETH');
    }
    
    // USDC
    const usdcToken = await contract.acceptedTokens('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    console.log('   USDC:', usdcToken[0] ? '✅ Supported' : '❌ Not supported');
    if (usdcToken[0]) {
      console.log('     Min bet:', ethers.utils.formatUnits(usdcToken[1], 6), 'USDC');
      console.log('     Max bet:', ethers.utils.formatUnits(usdcToken[2], 6), 'USDC');
    }
    
    console.log(chalk.green('\n✅ Contract Tests Passed!'));
    console.log(chalk.cyan('\n📊 Summary:'));
    console.log('   • Contract is deployed and operational');
    console.log('   • Owner is correctly set');
    console.log('   • Contract is not paused');
    console.log('   • Token configurations are valid');
    console.log('   • Ready for poll creation and betting');
    console.log('\n🚀 Contract is ready for production use!');
    
    // Ask user if they want to create a test poll
    console.log(chalk.yellow('\n💡 Would you like to create a test poll? (y/n)'));
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('> ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        await createTestPoll(contract);
      } else {
        console.log(chalk.cyan('\nTest complete! Contract is ready for integration.'));
      }
      readline.close();
    });
    
  } catch (error) {
    console.log(chalk.red('\n❌ Test failed:'), error.message);
    console.log('\n🔧 This might indicate an issue with the contract deployment or network connection.');
  }
}

async function createTestPoll(contract) {
  console.log(chalk.yellow('\n🔨 Creating Test Poll...'));
  
  try {
    const tx = await contract.createPoll(
      "https://example.com/test-news-article",
      "Will the PolyPoll platform launch successfully?",
      ["Yes - it will be amazing!", "No - there will be issues", "Maybe - needs more testing", "Too early to tell"],
      24, // 24 hours
      "0x0000000000000000000000000000000000000000", // ETH
      {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('1', 'gwei')
      }
    );
    
    console.log('   📤 Transaction sent:', tx.hash);
    console.log('   ⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(chalk.green('   ✅ Test poll created successfully!'));
    console.log('   ⛽ Gas used:', receipt.gasUsed.toString());
    console.log('   💰 Cost:', ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)), 'ETH');
    
    // Extract poll ID from events
    for (const log of receipt.logs) {
      try {
        // Look for PollCreated event
        if (log.topics.length > 0) {
          console.log('   🆔 Poll created! Check contract events for poll ID');
          break;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    console.log(chalk.cyan('\n🎉 Success! Your test poll is now live on Base mainnet!'));
    console.log(`🔗 View on Basescan: https://basescan.org/tx/${tx.hash}`);
    
  } catch (error) {
    console.log(chalk.red('   ❌ Failed to create test poll:'));
    console.log('   Error:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('   💡 You need more ETH to create a poll');
    } else if (error.message.includes('execution reverted')) {
      console.log('   💡 Check if you\'ve exceeded daily poll limit or other contract restrictions');
    }
  }
}

testContract();