// Direct deployment script without hardhat
const ethers = require('ethers');
const fs = require('fs');
require('dotenv').config();

// Contract ABI and bytecode
const contractData = JSON.parse(fs.readFileSync('./artifacts/contracts/PollyPoll.sol/PollyPoll.json', 'utf8'));

async function deploy() {
  console.log('🚀 Starting deployment to Base Mainnet...');
  
  // Connect to Base Mainnet
  const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log('👛 Deployer:', wallet.address);
  
  // Check balance
  const balance = await wallet.getBalance();
  console.log('💰 Balance:', ethers.utils.formatEther(balance), 'ETH');
  
  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    console.log('❌ Insufficient balance for deployment');
    process.exit(1);
  }
  
  // Create contract factory
  const contractFactory = new ethers.ContractFactory(
    contractData.abi,
    contractData.bytecode,
    wallet
  );
  
  // Fee recipient (same as deployer)
  const feeRecipient = process.env.FEE_RECIPIENT || wallet.address;
  console.log('🏦 Fee recipient:', feeRecipient);
  
  console.log('📦 Deploying contract...');
  
  // Deploy with explicit gas settings
  const contract = await contractFactory.deploy(feeRecipient, {
    gasLimit: 5000000,
    gasPrice: ethers.utils.parseUnits('1', 'gwei')
  });
  
  console.log('⏳ Waiting for deployment...');
  await contract.deployed();
  
  console.log('✅ Contract deployed!');
  console.log('📍 Address:', contract.address);
  console.log('🔗 Transaction:', contract.deployTransaction.hash);
  console.log('🌐 Basescan:', `https://basescan.org/address/${contract.address}`);
  
  // Save deployment info
  const deploymentInfo = {
    network: 'Base Mainnet',
    chainId: 8453,
    contractAddress: contract.address,
    transactionHash: contract.deployTransaction.hash,
    deployer: wallet.address,
    feeRecipient: feeRecipient,
    deployedAt: new Date().toISOString()
  };
  
  if (!fs.existsSync('./deployments')) {
    fs.mkdirSync('./deployments');
  }
  
  fs.writeFileSync(
    './deployments/baseMainnet-deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log('💾 Deployment info saved');
  
  // Update .env
  let envContent = fs.readFileSync('./.env', 'utf8');
  if (envContent.includes('CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(/CONTRACT_ADDRESS=.*/, `CONTRACT_ADDRESS=${contract.address}`);
  } else {
    envContent += `\nCONTRACT_ADDRESS=${contract.address}\n`;
  }
  fs.writeFileSync('./.env', envContent);
  
  console.log('📝 Updated .env file');
  console.log('🎉 Deployment complete!');
}

deploy().catch(console.error);