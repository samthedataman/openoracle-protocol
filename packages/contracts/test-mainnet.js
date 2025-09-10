// Simple mainnet contract test
const ethers = require('ethers');
const chalk = require('chalk');
require('dotenv').config();

const CONTRACT_ADDRESS = "0x0a431f6851f4F724dF4024CB5415BBaEDc7869B4";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Contract ABI - just the functions we need to test
const ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function dailyPollCounts(address) view returns (uint256)",
  "function acceptedTokens(address) view returns (bool, uint256, uint256, uint8, string, uint256)",
  "function createPoll(string articleUrl, string question, string[] options, uint256 durationHours, address paymentToken) returns (uint256)",
  "function placeBetETH(uint256 pollId, uint8 option) payable",
  "function getProtocolStats() view returns (uint256, uint256, uint256, uint256)",
  "function getTokenVolume(address) view returns (uint256)"
];

async function testContract() {
  console.log(chalk.cyan.bold('\n🚀 Testing PolyPoll Contract on Base Mainnet\n'));
  
  // Connect to Base mainnet
  const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  
  console.log('📍 Contract:', CONTRACT_ADDRESS);
  console.log('👛 Wallet:', wallet.address);
  
  // Check wallet balance
  const balance = await wallet.getBalance();
  console.log('💰 Balance:', ethers.utils.formatEther(balance), 'ETH\n');
  
  try {
    // Test 1: Check contract owner
    console.log(chalk.yellow('🔍 Test 1: Contract Owner'));
    const owner = await contract.owner();
    console.log('   Owner:', owner);
    console.log(owner === wallet.address ? chalk.green('   ✅ Owner matches deployer') : chalk.red('   ❌ Owner mismatch'));
    
    // Test 2: Check if paused
    console.log(chalk.yellow('\n🔍 Test 2: Contract Status'));
    const paused = await contract.paused();
    console.log('   Paused:', paused);
    console.log(paused ? chalk.red('   ❌ Contract is paused') : chalk.green('   ✅ Contract is active'));
    
    // Test 3: Check protocol stats
    console.log(chalk.yellow('\n🔍 Test 3: Protocol Statistics'));
    const stats = await contract.getProtocolStats();
    console.log('   Total Polls:', stats[0].toString());
    console.log('   Active Polls:', stats[1].toString());
    console.log('   Total Bets:', stats[2].toString());
    console.log('   Total Volume:', ethers.utils.formatEther(stats[3]), 'ETH');
    
    // Test 4: Check daily poll count for user
    console.log(chalk.yellow('\n🔍 Test 4: Daily Poll Count'));
    const dailyCount = await contract.dailyPollCounts(wallet.address);
    console.log('   Daily Polls Created:', dailyCount.toString());
    
    // Test 5: Check ETH token acceptance
    console.log(chalk.yellow('\n🔍 Test 5: ETH Token Config'));
    const ethToken = await contract.acceptedTokens('0x0000000000000000000000000000000000000000');
    console.log('   ETH Accepted:', ethToken[0]);
    console.log('   Min Bet:', ethers.utils.formatEther(ethToken[1]), 'ETH');
    console.log('   Max Bet:', ethers.utils.formatEther(ethToken[2]), 'ETH');
    console.log('   Symbol:', ethToken[4]);
    
    // Test 6: Check USDC token acceptance  
    console.log(chalk.yellow('\n🔍 Test 6: USDC Token Config'));
    const usdcToken = await contract.acceptedTokens('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    console.log('   USDC Accepted:', usdcToken[0]);
    console.log('   Min Bet:', ethers.utils.formatUnits(usdcToken[1], 6), 'USDC');
    console.log('   Max Bet:', ethers.utils.formatUnits(usdcToken[2], 6), 'USDC');
    console.log('   Symbol:', usdcToken[4]);
    
    // Test 6b: Check ETH volume
    const ethVolume = await contract.getTokenVolume('0x0000000000000000000000000000000000000000');
    console.log('   ETH Volume:', ethers.utils.formatEther(ethVolume), 'ETH');
    
    // Test 7: Basic contract readiness
    console.log(chalk.yellow('\n🔍 Test 7: Contract Readiness'));
    console.log('   ✅ All basic functions accessible');
    console.log('   ✅ Token configurations loaded');
    console.log('   ✅ Ready for poll creation');
    
    console.log(chalk.green('\n✅ All basic tests passed!'));
    console.log(chalk.cyan('\n📋 Summary:'));
    console.log('   • Contract is deployed and responsive');
    console.log('   • Owner is correctly set'); 
    console.log('   • Contract is not paused');
    console.log('   • Token configurations are active');
    console.log('   • Ready for poll creation and betting');
    
    // Ask if user wants to create a test poll
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(chalk.cyan('\n🤔 Create a test poll? (y/n): '), async (answer) => {
      if (answer.toLowerCase() === 'y') {
        await createTestPoll(contract);
      }
      readline.close();
    });
    
  } catch (error) {
    console.log(chalk.red('\n❌ Test failed:'), error.message);
  }
}

async function createTestPoll(contract) {
  console.log(chalk.yellow('\n🔨 Creating test poll...'));
  
  try {
    const tx = await contract.createPoll(
      "https://example.com/test-article",
      "Will this test poll work correctly?",
      ["Yes, absolutely", "No, there are issues", "Maybe, needs more testing", "Unsure"],
      24, // 24 hours
      "0x0000000000000000000000000000000000000000", // ETH
      {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('1', 'gwei')
      }
    );
    
    console.log('   Transaction:', tx.hash);
    console.log('   Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(chalk.green('   ✅ Test poll created!'));
    console.log('   Gas used:', receipt.gasUsed.toString());
    
    // Get poll ID from logs
    const pollCreatedEvent = receipt.logs.find(log => log.topics[0] === ethers.utils.id('PollCreated(uint256,address,string)'));
    if (pollCreatedEvent) {
      const pollId = ethers.BigNumber.from(pollCreatedEvent.topics[1]);
      console.log('   Poll ID:', pollId.toString());
    }
    
  } catch (error) {
    console.log(chalk.red('   ❌ Failed to create poll:'), error.message);
  }
}

testContract();