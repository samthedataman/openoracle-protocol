#!/usr/bin/env node

// scripts/deploy-helper.js
// Interactive deployment helper for Base Mainnet

const chalk = require("chalk");
const { execSync } = require("child_process");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log(chalk.cyan.bold("\n========================================"));
  console.log(chalk.cyan.bold("    🦜 PollyPoll Deployment Helper"));
  console.log(chalk.cyan.bold("========================================\n"));

  // Step 1: Check environment setup
  console.log(chalk.blue("Step 1: Checking environment setup...\n"));
  
  if (!fs.existsSync(path.join(__dirname, "../.env"))) {
    console.log(chalk.yellow("⚠️  No .env file found!"));
    
    const create = await askQuestion("Would you like to create one from .env.example? (y/n): ");
    if (create.toLowerCase() === 'y') {
      execSync("cp .env.example .env", { cwd: path.join(__dirname, "..") });
      console.log(chalk.green("✅ Created .env file"));
      console.log(chalk.yellow("📝 Please edit .env and add your private key\n"));
      
      const edit = await askQuestion("Press Enter when you've added your private key...");
    } else {
      console.log(chalk.red("Please create .env file with your private key"));
      rl.close();
      process.exit(1);
    }
  }

  // Step 2: Check balance
  console.log(chalk.blue("\nStep 2: Checking Base ETH balance...\n"));
  
  try {
    execSync("npm run balance", { 
      stdio: "inherit",
      cwd: path.join(__dirname, "..")
    });
  } catch (error) {
    console.log(chalk.red("Failed to check balance"));
    rl.close();
    process.exit(1);
  }

  // Step 3: Compile contract
  console.log(chalk.blue("\nStep 3: Compiling contract...\n"));
  
  const compile = await askQuestion("Compile contract? (y/n): ");
  if (compile.toLowerCase() === 'y') {
    try {
      execSync("npm run compile", { 
        stdio: "inherit",
        cwd: path.join(__dirname, "..")
      });
      console.log(chalk.green("\n✅ Contract compiled successfully\n"));
    } catch (error) {
      console.log(chalk.red("Compilation failed"));
      rl.close();
      process.exit(1);
    }
  }

  // Step 4: Choose network
  console.log(chalk.blue("\nStep 4: Choose deployment network:\n"));
  console.log("1. Base Mainnet (Real ETH)");
  console.log("2. Base Sepolia (Test ETH)");
  console.log("3. Local Hardhat Network");
  
  const network = await askQuestion("\nEnter choice (1-3): ");
  
  let deployCommand;
  switch(network) {
    case '1':
      console.log(chalk.yellow("\n⚠️  MAINNET DEPLOYMENT - REAL MONEY"));
      const confirm = await askQuestion("Are you SURE you want to deploy to mainnet? (yes/no): ");
      if (confirm.toLowerCase() !== 'yes') {
        console.log(chalk.red("Deployment cancelled"));
        rl.close();
        process.exit(0);
      }
      deployCommand = "npm run deploy:base-mainnet-safe";
      break;
    case '2':
      deployCommand = "npm run deploy:base-sepolia";
      break;
    case '3':
      deployCommand = "npm run deploy:local";
      break;
    default:
      console.log(chalk.red("Invalid choice"));
      rl.close();
      process.exit(1);
  }

  // Step 5: Deploy
  console.log(chalk.blue("\nStep 5: Deploying contract...\n"));
  
  try {
    execSync(deployCommand, { 
      stdio: "inherit",
      cwd: path.join(__dirname, "..")
    });
    
    console.log(chalk.green.bold("\n✅ Deployment successful!\n"));
    
    // Step 6: Post-deployment
    if (network === '1' || network === '2') {
      const verify = await askQuestion("Verify contract on Basescan? (y/n): ");
      if (verify.toLowerCase() === 'y') {
        const verifyCommand = network === '1' ? "npm run verify:mainnet" : "npm run verify:base-sepolia";
        try {
          execSync(verifyCommand, { 
            stdio: "inherit",
            cwd: path.join(__dirname, "..")
          });
        } catch (error) {
          console.log(chalk.yellow("Verification failed - you can verify manually later"));
        }
      }
      
      console.log(chalk.cyan("\n📋 Next Steps:"));
      console.log("1. Test with small amount: npm run interact:mainnet");
      console.log("2. Update Chrome extension with contract address");
      console.log("3. Monitor on Basescan\n");
    }
    
  } catch (error) {
    console.log(chalk.red("\nDeployment failed"));
    console.log(chalk.yellow("Check error messages above"));
  }
  
  rl.close();
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  rl.close();
  process.exit(1);
});