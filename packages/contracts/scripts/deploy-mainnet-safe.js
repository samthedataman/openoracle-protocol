// scripts/deploy-mainnet-safe.js
// Safe deployment script for Base Mainnet with confirmations

const hre = require("hardhat");
const readline = require("readline");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");

// Base Mainnet Configuration
const BASE_MAINNET = {
  chainId: 8453,
  name: "Base Mainnet",
  explorer: "https://basescan.org",
  rpc: "https://mainnet.base.org",
  tokens: {
    ETH: "0x0000000000000000000000000000000000000000",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    PYUSD: "0xCaA940D48b22B8f3fb53b7d5EB0a0e43Bc261D3c",
    cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    WETH: "0x4200000000000000000000000000000000000006"
  }
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask for confirmation
function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Helper function to format ETH
function formatETH(wei) {
  return ethers.utils.formatEther(wei);
}

// Helper function to format USD estimate
function formatUSD(ethAmount, ethPrice = 4000) {
  return (parseFloat(ethAmount) * ethPrice).toFixed(2);
}

async function main() {
  console.log(chalk.cyan.bold("\n========================================"));
  console.log(chalk.cyan.bold("   PollyPoll Base Mainnet Deployment"));
  console.log(chalk.cyan.bold("========================================\n"));

  // Check network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BASE_MAINNET.chainId) {
    console.log(chalk.red(`❌ Wrong network! Expected Base Mainnet (${BASE_MAINNET.chainId}), got ${network.chainId}`));
    console.log(chalk.yellow("Run with: npm run deploy:base"));
    process.exit(1);
  }

  console.log(chalk.green(`✅ Connected to ${BASE_MAINNET.name}`));
  console.log(chalk.gray(`   Chain ID: ${BASE_MAINNET.chainId}`));
  console.log(chalk.gray(`   RPC: ${BASE_MAINNET.rpc}`));
  console.log(chalk.gray(`   Explorer: ${BASE_MAINNET.explorer}\n`));

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const balanceBefore = await deployer.getBalance();
  
  console.log(chalk.blue("📱 Deployer Account:"));
  console.log(`   Address: ${chalk.white(deployer.address)}`);
  console.log(`   Balance Before: ${chalk.white(formatETH(balanceBefore))} ETH`);
  console.log(`   ≈ $${formatUSD(formatETH(balanceBefore))}\n`);

  // Check minimum balance (0.01 ETH recommended)
  const minBalance = ethers.utils.parseEther("0.01");
  if (balanceBefore.lt(minBalance)) {
    console.log(chalk.red("❌ Insufficient balance!"));
    console.log(chalk.yellow(`   Minimum recommended: 0.01 ETH`));
    console.log(chalk.yellow(`   You have: ${formatETH(balanceBefore)} ETH`));
    console.log(chalk.yellow(`   Bridge more ETH at: https://bridge.base.org/`));
    process.exit(1);
  }

  // Get fee recipient
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  console.log(chalk.blue("💰 Fee Recipient (Treasury):"));
  console.log(`   Address: ${chalk.white(feeRecipient)}`);
  if (feeRecipient === deployer.address) {
    console.log(chalk.gray("   (Same as deployer)"));
  }
  console.log();

  // Display contract configuration
  console.log(chalk.blue("📜 Contract Configuration:"));
  console.log(`   Platform Fee: ${chalk.white("2.5%")}`);
  console.log(`   Creator Reward: ${chalk.white("0.5%")}`);
  console.log(`   Poll Duration: ${chalk.white("24-96 hours")}`);
  console.log(`   Max Daily Polls: ${chalk.white("10")}`);
  console.log(`   Min Participants: ${chalk.white("2")}\n`);

  console.log(chalk.blue("💎 Accepted Tokens:"));
  console.log(`   ETH:   ${chalk.white("0.0001 - 0.1 ETH per bet")}`);
  console.log(`   USDC:  ${chalk.white("1 - 10,000 USDC per bet")}`);
  console.log(`   PYUSD: ${chalk.white("1 - 10,000 PYUSD per bet")}`);
  console.log(`   cbETH: ${chalk.white("0.0001 - 0.1 cbETH per bet")}\n`);

  // Estimate deployment cost
  console.log(chalk.blue("⛽ Estimated Deployment Cost:"));
  const estimatedGas = 3000000; // ~3M gas for contract deployment
  const gasPrice = await ethers.provider.getGasPrice();
  const estimatedCost = gasPrice.mul(estimatedGas);
  
  console.log(`   Estimated Gas: ${chalk.white(estimatedGas.toLocaleString())} units`);
  console.log(`   Gas Price: ${chalk.white(ethers.utils.formatUnits(gasPrice, "gwei"))} gwei`);
  console.log(`   Estimated Cost: ${chalk.white(formatETH(estimatedCost))} ETH`);
  console.log(`   ≈ $${chalk.white(formatUSD(formatETH(estimatedCost)))}\n`);

  // Token addresses confirmation
  console.log(chalk.blue("📍 Token Addresses (Base Mainnet):"));
  console.log(`   USDC:  ${chalk.gray(BASE_MAINNET.tokens.USDC)}`);
  console.log(`   PYUSD: ${chalk.gray(BASE_MAINNET.tokens.PYUSD)}`);
  console.log(`   cbETH: ${chalk.gray(BASE_MAINNET.tokens.cbETH)}\n`);

  // Final confirmation
  console.log(chalk.yellow.bold("⚠️  THIS IS MAINNET - REAL MONEY ⚠️"));
  console.log(chalk.yellow("Please review all settings above carefully.\n"));
  
  const confirmed = await askConfirmation(chalk.cyan("Do you want to proceed with deployment? (yes/no): "));
  
  if (!confirmed) {
    console.log(chalk.red("\n❌ Deployment cancelled by user"));
    rl.close();
    process.exit(0);
  }

  console.log(chalk.green("\n✅ Proceeding with deployment...\n"));

  try {
    // Deploy PollyPoll contract
    console.log(chalk.cyan("📦 Deploying PollyPoll contract..."));
    const PollyPoll = await ethers.getContractFactory("PollyPoll");
    
    const pollyPoll = await PollyPoll.deploy(feeRecipient);
    
    console.log(chalk.gray(`   Transaction hash: ${pollyPoll.deployTransaction.hash}`));
    console.log(chalk.gray(`   Waiting for confirmation...`));
    
    // Wait for deployment
    await pollyPoll.deployed();
    
    console.log(chalk.green.bold(`\n✅ PollyPoll deployed successfully!`));
    console.log(chalk.white(`   Contract Address: ${pollyPoll.address}`));
    console.log(chalk.white(`   View on Basescan: ${BASE_MAINNET.explorer}/address/${pollyPoll.address}\n`));
    
    // Show contract balance (should be 0 initially)
    const contractBalance = await ethers.provider.getBalance(pollyPoll.address);
    console.log(chalk.blue("📊 Contract Balance:"));
    console.log(`   Initial Balance: ${chalk.white(formatETH(contractBalance))} ETH`);
    console.log(chalk.gray(`   (Contract starts with 0 ETH, will receive ETH from bets)\n`));
    
    // Wait for block confirmations
    console.log(chalk.cyan("⏳ Waiting for 5 block confirmations..."));
    await pollyPoll.deployTransaction.wait(5);
    console.log(chalk.green("✅ Confirmations received\n"));
    
    // Get actual deployment cost
    const receipt = await ethers.provider.getTransactionReceipt(pollyPoll.deployTransaction.hash);
    const actualCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    
    console.log(chalk.blue("💰 Actual Deployment Cost:"));
    console.log(`   Gas Used: ${chalk.white(receipt.gasUsed.toLocaleString())} units`);
    console.log(`   Gas Price: ${chalk.white(ethers.utils.formatUnits(receipt.effectiveGasPrice, "gwei"))} gwei`);
    console.log(`   Total Cost: ${chalk.white(formatETH(actualCost))} ETH`);
    console.log(`   ≈ $${chalk.white(formatUSD(formatETH(actualCost)))}\n`);
    
    // Show deployer balance after deployment
    const balanceAfter = await deployer.getBalance();
    const balanceUsed = balanceBefore.sub(balanceAfter);
    
    console.log(chalk.blue("💼 Wallet Balance After Deployment:"));
    console.log(`   Balance After: ${chalk.white(formatETH(balanceAfter))} ETH`);
    console.log(`   ETH Used: ${chalk.white(formatETH(balanceUsed))} ETH`);
    console.log(`   Remaining: ${chalk.white(formatETH(balanceAfter))} ETH`);
    console.log(`   ≈ $${chalk.white(formatUSD(formatETH(balanceAfter)))} remaining\n`);
    
    // Save deployment information
    console.log(chalk.cyan("💾 Saving deployment information..."));
    
    // Save to deployments directory
    const deploymentInfo = {
      network: "Base Mainnet",
      chainId: BASE_MAINNET.chainId,
      contractAddress: pollyPoll.address,
      feeRecipient: feeRecipient,
      deployer: deployer.address,
      transactionHash: pollyPoll.deployTransaction.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      deploymentCost: formatETH(actualCost),
      deploymentCostUSD: formatUSD(formatETH(actualCost)),
      timestamp: new Date().toISOString(),
      explorer: `${BASE_MAINNET.explorer}/address/${pollyPoll.address}`,
      tokens: BASE_MAINNET.tokens
    };
    
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }
    
    const deploymentFile = path.join(deploymentsDir, "base-mainnet-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(chalk.green(`   Saved to: deployments/base-mainnet-deployment.json`));
    
    // Update .env file
    const envFile = path.join(__dirname, "../.env");
    if (fs.existsSync(envFile)) {
      let envContent = fs.readFileSync(envFile, "utf8");
      
      // Update or add CONTRACT_ADDRESS
      if (envContent.includes("CONTRACT_ADDRESS=")) {
        envContent = envContent.replace(/CONTRACT_ADDRESS=.*/, `CONTRACT_ADDRESS=${pollyPoll.address}`);
      } else {
        envContent += `\n# Deployed Contract Address\nCONTRACT_ADDRESS=${pollyPoll.address}\n`;
      }
      
      fs.writeFileSync(envFile, envContent);
      console.log(chalk.green(`   Updated .env with CONTRACT_ADDRESS\n`));
    }
    
    // Display next steps
    console.log(chalk.cyan.bold("========================================"));
    console.log(chalk.cyan.bold("        DEPLOYMENT SUCCESSFUL! 🎉"));
    console.log(chalk.cyan.bold("========================================\n"));
    
    console.log(chalk.green("📋 Next Steps:\n"));
    console.log(`1. ${chalk.white("Verify on Basescan")}:`);
    console.log(chalk.gray(`   npm run verify:base\n`));
    
    console.log(`2. ${chalk.white("Test with small amount")}:`);
    console.log(chalk.gray(`   node scripts/test-contract.js create  # Create test poll`));
    console.log(chalk.gray(`   node scripts/test-contract.js test    # Run test suite`));
    console.log(chalk.gray(`   node scripts/monitor-polls.js simple  # Monitor contract\n`));
    
    console.log(`3. ${chalk.white("Update Chrome Extension")}:`);
    console.log(chalk.gray(`   Contract: ${pollyPoll.address}`));
    console.log(chalk.gray(`   Chain ID: ${BASE_MAINNET.chainId}`));
    console.log(chalk.gray(`   Network: Base Mainnet\n`));
    
    console.log(`4. ${chalk.white("Monitor Contract")}:`);
    console.log(chalk.gray(`   ${BASE_MAINNET.explorer}/address/${pollyPoll.address}\n`));
    
    console.log(chalk.green.bold("🦜 PollyPoll is now LIVE on Base Mainnet! 🦜\n"));
    
  } catch (error) {
    console.log(chalk.red("\n❌ Deployment failed!"));
    console.log(chalk.red(`   Error: ${error.message}`));
    
    if (error.message.includes("insufficient funds")) {
      console.log(chalk.yellow("\n💡 Tip: You need more ETH for deployment"));
      console.log(chalk.yellow(`   Bridge ETH at: https://bridge.base.org/`));
    }
    
    rl.close();
    process.exit(1);
  }
  
  rl.close();
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("Fatal error:"), error);
    rl.close();
    process.exit(1);
  });