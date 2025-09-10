// scripts/check-balance.js
// Check Base ETH balance and deployment readiness

const { ethers } = require("hardhat");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Network configurations
const NETWORKS = {
  baseMainnet: {
    name: "Base Mainnet",
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    bridge: "https://bridge.base.org",
    minBalance: "0.01", // Minimum recommended for deployment
    deploymentCost: "0.003", // Estimated deployment cost
  },
  baseSepolia: {
    name: "Base Sepolia Testnet",
    chainId: 84532,
    rpc: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    faucet: "https://www.coinbase.com/faucets",
    minBalance: "0.01",
    deploymentCost: "0.003",
  }
};

async function checkBalance() {
  console.log(chalk.cyan.bold("\n========================================"));
  console.log(chalk.cyan.bold("     Base ETH Balance Checker"));
  console.log(chalk.cyan.bold("========================================\n"));

  // Check if private key is set
  if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === "your_private_key_here") {
    console.log(chalk.red("❌ Private key not configured!"));
    console.log(chalk.yellow("\n📝 Setup Instructions:"));
    console.log(chalk.white("1. Create/edit .env file in contracts directory"));
    console.log(chalk.white("2. Add your private key:"));
    console.log(chalk.gray("   PRIVATE_KEY=your_actual_private_key_here"));
    console.log(chalk.white("3. Never commit .env to git!\n"));
    
    // Check if .env.example exists
    const envExamplePath = path.join(__dirname, "../.env.example");
    if (fs.existsSync(envExamplePath)) {
      console.log(chalk.blue("💡 Tip: Copy .env.example to get started:"));
      console.log(chalk.gray("   cp .env.example .env\n"));
    }
    
    process.exit(1);
  }

  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const address = wallet.address;
    
    console.log(chalk.blue("👛 Wallet Address:"));
    console.log(chalk.white(`   ${address}\n`));
    
    // Check balance on both networks
    for (const [key, network] of Object.entries(NETWORKS)) {
      await checkNetworkBalance(wallet, network);
    }
    
    // Show bridging/funding instructions
    console.log(chalk.cyan.bold("\n💰 How to Get ETH on Base:\n"));
    
    console.log(chalk.yellow("For Base Mainnet:"));
    console.log(chalk.white("1. Bridge from Ethereum:"));
    console.log(chalk.blue(`   ${NETWORKS.baseMainnet.bridge}`));
    console.log(chalk.gray("   - Connect wallet"));
    console.log(chalk.gray("   - Select ETH amount"));
    console.log(chalk.gray("   - Bridge to Base (takes ~10-20 min)\n"));
    
    console.log(chalk.white("2. Buy on Exchange:"));
    console.log(chalk.gray("   - Buy ETH on Coinbase"));
    console.log(chalk.gray("   - Withdraw to Base network"));
    console.log(chalk.gray("   - Select 'Base' as withdrawal network\n"));
    
    console.log(chalk.yellow("For Base Sepolia (Testnet):"));
    console.log(chalk.white("1. Get test ETH:"));
    console.log(chalk.blue(`   ${NETWORKS.baseSepolia.faucet}`));
    console.log(chalk.gray("   - Or bridge Sepolia ETH via Base Bridge\n"));
    
    // Check contract compilation status
    await checkContractStatus();
    
  } catch (error) {
    console.log(chalk.red("\n❌ Error checking balance:"));
    console.log(chalk.red(`   ${error.message}\n`));
    
    if (error.message.includes("invalid private key")) {
      console.log(chalk.yellow("💡 Make sure your private key is correct"));
      console.log(chalk.yellow("   It should be a 64-character hex string"));
      console.log(chalk.yellow("   Example: 0x1234...abcd (64 characters total)\n"));
    }
  }
}

async function checkNetworkBalance(wallet, network) {
  console.log(chalk.blue(`📊 ${network.name}:`));
  
  try {
    // Connect to network
    const provider = new ethers.providers.JsonRpcProvider(network.rpc);
    const connectedWallet = wallet.connect(provider);
    
    // Check network
    const networkInfo = await provider.getNetwork();
    if (networkInfo.chainId !== network.chainId) {
      console.log(chalk.yellow(`   ⚠️  Network mismatch (expected ${network.chainId}, got ${networkInfo.chainId})`));
      return;
    }
    
    // Get balance
    const balance = await connectedWallet.getBalance();
    const balanceETH = ethers.utils.formatEther(balance);
    const balanceUSD = (parseFloat(balanceETH) * 4000).toFixed(2); // Assuming $4000/ETH
    
    // Get gas price
    const gasPrice = await provider.getGasPrice();
    const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
    
    // Display balance
    console.log(`   Balance: ${chalk.white(balanceETH)} ETH ${chalk.gray(`(≈ $${balanceUSD})`)}`);
    console.log(`   Gas Price: ${chalk.white(gasPriceGwei)} gwei`);
    
    // Check if sufficient for deployment
    const minBalance = ethers.utils.parseEther(network.minBalance);
    const deploymentCost = ethers.utils.parseEther(network.deploymentCost);
    
    if (balance.gte(minBalance)) {
      console.log(chalk.green(`   ✅ Sufficient for deployment`));
      
      // Calculate how many deployments possible
      const possibleDeployments = balance.div(deploymentCost);
      if (possibleDeployments.gt(0)) {
        console.log(chalk.gray(`   Can deploy ~${possibleDeployments.toString()} contracts`));
      }
      
      // Show estimated remaining after deployment
      const remainingAfterDeploy = balance.sub(deploymentCost);
      const remainingETH = ethers.utils.formatEther(remainingAfterDeploy);
      console.log(chalk.gray(`   After deployment: ~${remainingETH} ETH remaining`));
      
    } else {
      const needed = ethers.utils.formatEther(minBalance.sub(balance));
      console.log(chalk.red(`   ❌ Insufficient balance`));
      console.log(chalk.yellow(`   Need ${needed} more ETH for deployment`));
      
      if (network.faucet) {
        console.log(chalk.blue(`   Get test ETH: ${network.faucet}`));
      } else {
        console.log(chalk.blue(`   Bridge ETH: ${network.bridge}`));
      }
    }
    
    // Show explorer link
    console.log(chalk.gray(`   View on explorer: ${network.explorer}/address/${wallet.address}`));
    console.log();
    
  } catch (error) {
    console.log(chalk.yellow(`   ⚠️  Could not connect to ${network.name}`));
    console.log(chalk.gray(`   ${error.message}`));
    console.log();
  }
}

async function checkContractStatus() {
  console.log(chalk.cyan.bold("📜 Contract Status:\n"));
  
  // Check if contract is compiled
  const artifactPath = path.join(__dirname, "../artifacts/contracts/PollyPoll.sol/PollyPoll.json");
  if (fs.existsSync(artifactPath)) {
    console.log(chalk.green("✅ Contract compiled"));
    
    // Get contract size
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const bytecodeSize = artifact.bytecode.length / 2; // Each byte is 2 hex characters
    const sizeKB = (bytecodeSize / 1024).toFixed(2);
    
    console.log(chalk.gray(`   Size: ${sizeKB} KB`));
    
    if (bytecodeSize > 24576) { // 24KB limit
      console.log(chalk.yellow(`   ⚠️  Contract may be too large (limit: 24KB)`));
    }
  } else {
    console.log(chalk.yellow("⚠️  Contract not compiled"));
    console.log(chalk.white("   Run: npm run compile"));
  }
  
  // Check if already deployed
  const mainnetDeployment = path.join(__dirname, "../deployments/base-mainnet-deployment.json");
  const sepoliaDeployment = path.join(__dirname, "../deployments/baseSepolia-deployment.json");
  
  if (fs.existsSync(mainnetDeployment)) {
    const deployment = JSON.parse(fs.readFileSync(mainnetDeployment, "utf8"));
    console.log(chalk.blue("\n📍 Existing Mainnet Deployment:"));
    console.log(chalk.white(`   Address: ${deployment.contractAddress}`));
    console.log(chalk.gray(`   Deployed: ${deployment.timestamp}`));
    console.log(chalk.blue(`   ${deployment.explorer}`));
  }
  
  if (fs.existsSync(sepoliaDeployment)) {
    const deployment = JSON.parse(fs.readFileSync(sepoliaDeployment, "utf8"));
    console.log(chalk.blue("\n📍 Existing Testnet Deployment:"));
    console.log(chalk.white(`   Address: ${deployment.contractAddress || deployment.pollyPoll}`));
    console.log(chalk.gray(`   Deployed: ${deployment.deployedAt || deployment.timestamp}`));
  }
  
  console.log();
}

// Quick balance check function for other scripts to use
async function getQuickBalance(networkKey = "baseMainnet") {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not configured");
  }
  
  const network = NETWORKS[networkKey];
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  const provider = new ethers.providers.JsonRpcProvider(network.rpc);
  const connectedWallet = wallet.connect(provider);
  
  const balance = await connectedWallet.getBalance();
  const balanceETH = ethers.utils.formatEther(balance);
  
  return {
    address: wallet.address,
    balance: balance,
    balanceETH: balanceETH,
    balanceUSD: (parseFloat(balanceETH) * 4000).toFixed(2),
    network: network.name,
    chainId: network.chainId,
    sufficient: balance.gte(ethers.utils.parseEther(network.minBalance))
  };
}

// Export for use in other scripts
module.exports = {
  checkBalance,
  getQuickBalance,
  NETWORKS
};

// Run if called directly
if (require.main === module) {
  checkBalance()
    .then(() => {
      console.log(chalk.green.bold("✨ Balance check complete!\n"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red("Fatal error:"), error);
      process.exit(1);
    });
}