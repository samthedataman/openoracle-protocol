// scripts/verify-mainnet.js
// Verification script for Base Mainnet contract

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

async function main() {
  console.log(chalk.cyan.bold("\n========================================"));
  console.log(chalk.cyan.bold("    Verifying Contract on Basescan"));
  console.log(chalk.cyan.bold("========================================\n"));

  // Load deployment info
  const deploymentFile = path.join(__dirname, "../deployments/base-mainnet-deployment.json");
  
  if (!fs.existsSync(deploymentFile)) {
    console.log(chalk.red("❌ Deployment file not found!"));
    console.log(chalk.yellow("   Please deploy the contract first using:"));
    console.log(chalk.yellow("   npm run deploy:base-mainnet-safe"));
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  
  console.log(chalk.blue("📜 Contract Information:"));
  console.log(`   Address: ${chalk.white(deployment.contractAddress)}`);
  console.log(`   Network: ${chalk.white(deployment.network)}`);
  console.log(`   Fee Recipient: ${chalk.white(deployment.feeRecipient)}\n`);

  // Check if API key is set
  if (!process.env.BASESCAN_API_KEY || process.env.BASESCAN_API_KEY === "YOUR_BASESCAN_API_KEY") {
    console.log(chalk.yellow("⚠️  Basescan API key not set!"));
    console.log(chalk.yellow("   You can still verify manually at:"));
    console.log(chalk.blue(`   ${deployment.explorer}/verifyContract\n`));
    
    console.log(chalk.cyan("Manual verification parameters:"));
    console.log(`   Contract Address: ${deployment.contractAddress}`);
    console.log(`   Compiler Version: v0.8.19+commit.7dd6d404`);
    console.log(`   Optimization: Yes (200 runs)`);
    console.log(`   Constructor Arguments:`);
    console.log(`   - feeRecipient: ${deployment.feeRecipient}\n`);
    
    const proceed = await askConfirmation("Do you want to try automatic verification anyway? (y/n): ");
    if (!proceed) {
      process.exit(0);
    }
  }

  console.log(chalk.cyan("🔍 Starting verification process...\n"));

  try {
    await hre.run("verify:verify", {
      address: deployment.contractAddress,
      constructorArguments: [deployment.feeRecipient],
      contract: "contracts/PollyPoll.sol:PollyPoll"
    });

    console.log(chalk.green.bold("\n✅ Contract verified successfully!"));
    console.log(chalk.white(`   View on Basescan: ${deployment.explorer}\n`));
    
    // Update deployment file with verification status
    deployment.verified = true;
    deployment.verifiedAt = new Date().toISOString();
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
    
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(chalk.green("✅ Contract is already verified!"));
      console.log(chalk.white(`   View on Basescan: ${deployment.explorer}\n`));
    } else {
      console.log(chalk.red("\n❌ Verification failed!"));
      console.log(chalk.red(`   Error: ${error.message}\n`));
      
      console.log(chalk.yellow("💡 You can verify manually at:"));
      console.log(chalk.blue(`   ${deployment.explorer}/verifyContract\n`));
      
      console.log(chalk.cyan("Manual verification parameters:"));
      console.log(`   Contract Address: ${deployment.contractAddress}`);
      console.log(`   Compiler: v0.8.19+commit.7dd6d404`);
      console.log(`   Optimization: Yes (200 runs)`);
      console.log(`   Constructor Argument (ABI-encoded):`);
      
      // Encode constructor arguments
      const abiCoder = new ethers.utils.AbiCoder();
      const encodedArgs = abiCoder.encode(["address"], [deployment.feeRecipient]);
      console.log(`   ${encodedArgs.slice(2)}\n`); // Remove 0x prefix
    }
  }
}

function askConfirmation(question) {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });