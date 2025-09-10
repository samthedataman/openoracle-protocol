// deployment/deploy.js
// Hardhat deployment script for PollyPoll on Base Ethereum L2

const hre = require("hardhat");

async function main() {
  const networkName = hre.network.name;
  console.log(`🚀 Deploying PolyPoll to ${networkName}...`);
  
  // Network-specific configuration
  const networkConfig = {
    baseSepolia: {
      name: "Base Sepolia Testnet",
      chainId: 84532,
      explorer: "https://sepolia.basescan.org",
      confirmations: 3
    },
    baseMainnet: {
      name: "Base Mainnet",
      chainId: 8453,
      explorer: "https://basescan.org",
      confirmations: 5
    },
    hardhat: {
      name: "Local Hardhat",
      chainId: 31337,
      explorer: "N/A",
      confirmations: 1
    }
  };
  
  const config = networkConfig[networkName] || networkConfig.hardhat;
  console.log(`📍 Network: ${config.name} (Chain ID: ${config.chainId})`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  // Check if balance is sufficient
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.log("⚠️  Warning: Low balance. You may need more ETH for deployment.");
  }

  // Deploy PolyPoll contract
  const PolyPoll = await ethers.getContractFactory("PolyPoll");
  
  // Set fee recipient (can be same as deployer or separate treasury)
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  console.log("Fee Recipient:", feeRecipient);
  
  const polyPoll = await PolyPoll.deploy(feeRecipient);
  await polyPoll.deployed();

  console.log("✅ PolyPoll deployed to:", polyPoll.address);
  console.log("   Transaction hash:", polyPoll.deployTransaction.hash);
  
  // Wait for block confirmations
  console.log(`Waiting for ${config.confirmations} block confirmations...`);
  await polyPoll.deployTransaction.wait(config.confirmations);
  
  // Verify contract on Basescan
  if (networkName === "baseSepolia" || networkName === "baseMainnet") {
    console.log("Verifying contract on Basescan...");
    console.log(`Explorer: ${config.explorer}/address/${polyPoll.address}`);
    
    // Wait a bit for Basescan to index the contract
    console.log("Waiting 30 seconds for Basescan to index the contract...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      await hre.run("verify:verify", {
        address: polyPoll.address,
        constructorArguments: [feeRecipient],
      });
      console.log("✅ Contract verified on Basescan");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
      console.log("You can verify manually at:", `${config.explorer}/verifyContract`);
    }
  }
  
  // Save deployment addresses
  const fs = require("fs");
  const deploymentInfo = {
    network: networkName,
    polyPoll: polyPoll.address,
    feeRecipient: feeRecipient,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }
  
  fs.writeFileSync(
    `./deployments/${networkName}-deployment.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n📝 Deployment info saved to deployments/", networkName, "-deployment.json");
  console.log("\n🎉 Deployment complete!");
  
  // Display next steps
  console.log("\n📋 Next Steps:");
  console.log("1. Update .env with CONTRACT_ADDRESS=" + polyPoll.address);
  console.log("2. Run 'npm run create-poll' to create your first poll");
  console.log("3. Update extension with contract address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });