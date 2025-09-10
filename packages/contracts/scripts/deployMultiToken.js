// scripts/deployMultiToken.js
const hre = require("hardhat");

async function main() {
  console.log("🦜 Deploying PolyPoll Multi-Token Contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log();

  // Network detection
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log();

  let usdcAddress, pyusdAddress;

  // Deploy mock tokens on testnet
  if (network.chainId === 545 || network.chainId === 31337) { // Flow testnet or local
    console.log("📝 Deploying mock tokens for testing...");
    
    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();
    usdcAddress = mockUSDC.address;
    console.log("MockUSDC deployed to:", usdcAddress);
    
    // Deploy MockPYUSD
    const MockPYUSD = await ethers.getContractFactory("MockPYUSD");
    const mockPYUSD = await MockPYUSD.deploy();
    await mockPYUSD.deployed();
    pyusdAddress = mockPYUSD.address;
    console.log("MockPYUSD deployed to:", pyusdAddress);
    
    // Deploy additional mock tokens
    const MockDAI = await ethers.getContractFactory("MockDAI");
    const mockDAI = await MockDAI.deploy();
    await mockDAI.deployed();
    console.log("MockDAI deployed to:", mockDAI.address);
    
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.deployed();
    console.log("MockUSDT deployed to:", mockUSDT.address);
    console.log();
    
    // Mint some tokens for testing
    console.log("💰 Minting test tokens...");
    const testAddresses = [
      deployer.address,
      // Add more test addresses here if needed
    ];
    
    for (const address of testAddresses) {
      await mockUSDC.mint(address, ethers.utils.parseUnits("10000", 6));
      await mockPYUSD.mint(address, ethers.utils.parseUnits("10000", 6));
      await mockDAI.mint(address, ethers.utils.parseEther("10000"));
      await mockUSDT.mint(address, ethers.utils.parseUnits("10000", 6));
      console.log(`Minted tokens to ${address}`);
    }
    console.log();
    
  } else if (network.chainId === 747) { // Flow mainnet
    console.log("📝 Using mainnet token addresses...");
    usdcAddress = "0xF1815bd50389c46847f0Bda824eC8da914045D14"; // Bridged USDC on Flow
    pyusdAddress = ethers.constants.AddressZero; // PYUSD not yet deployed on Flow
    console.log("USDC address:", usdcAddress);
    console.log("PYUSD: Not yet available on Flow mainnet");
    console.log();
  } else {
    throw new Error("Unsupported network");
  }

  // Deploy PollyPollMultiToken
  console.log("🚀 Deploying PollyPollMultiToken contract...");
  const PollyPollMultiToken = await ethers.getContractFactory("PollyPollMultiToken");
  const pollyPoll = await PollyPollMultiToken.deploy(
    deployer.address, // Fee recipient
    usdcAddress,
    pyusdAddress
  );
  await pollyPoll.deployed();
  
  console.log("✅ PollyPollMultiToken deployed to:", pollyPoll.address);
  console.log();

  // Add additional tokens if on testnet
  if (network.chainId === 545 || network.chainId === 31337) {
    console.log("🔧 Adding additional test tokens...");
    
    // Get deployed mock tokens
    const mockDAI = await ethers.getContractAt("MockDAI", 
      (await ethers.getContractFactory("MockDAI")).attach(
        await (await ethers.getContractFactory("MockDAI")).deploy()
      ).address
    );
    
    const mockUSDT = await ethers.getContractAt("MockUSDT",
      (await ethers.getContractFactory("MockUSDT")).attach(
        await (await ethers.getContractFactory("MockUSDT")).deploy()
      ).address
    );
    
    // Add DAI
    await pollyPoll.addToken(
      mockDAI.address,
      "DAI",
      18,
      ethers.utils.parseEther("1"),      // 1 DAI min
      ethers.utils.parseEther("10000")    // 10,000 DAI max
    );
    console.log("Added DAI token");
    
    // Add USDT
    await pollyPoll.addToken(
      mockUSDT.address,
      "USDT",
      6,
      ethers.utils.parseUnits("1", 6),    // 1 USDT min
      ethers.utils.parseUnits("10000", 6) // 10,000 USDT max
    );
    console.log("Added USDT token");
    console.log();
  }

  // Verify contract configuration
  console.log("📊 Contract Configuration:");
  console.log("Fee Recipient:", await pollyPoll.feeRecipient());
  console.log("USDC Address:", await pollyPoll.USDC());
  console.log("PYUSD Address:", await pollyPoll.PYUSD());
  console.log("Platform Fee:", "2.5%");
  console.log("Poll Duration:", "24 hours");
  console.log("Max Daily Polls:", "10");
  console.log();

  // Save deployment addresses
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    pollyPollMultiToken: pollyPoll.address,
    tokens: {
      USDC: usdcAddress,
      PYUSD: pyusdAddress,
    },
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "../deployments");
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, `multitoken-${network.chainId}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("💾 Deployment info saved to deployments/multitoken-" + network.chainId + ".json");
  console.log();
  
  // Verify on block explorer if not local
  if (network.chainId !== 31337) {
    console.log("📝 Verify contract on block explorer:");
    console.log(`npx hardhat verify --network ${network.name} ${pollyPoll.address} ${deployer.address} ${usdcAddress} ${pyusdAddress}`);
  }
  
  console.log("\n✨ Deployment complete!");
  console.log("\n🦜 PolyPoll Multi-Token is ready for cross-currency prediction markets!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });