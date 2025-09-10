# 🚀 Base Mainnet Deployment Guide

## Pre-Deployment Checklist

### 1. ✅ Wallet Preparation
- [ ] Have at least 0.02 ETH on Base Mainnet
- [ ] Private key ready (never commit to git!)
- [ ] Backup wallet seed phrase

### 2. ✅ Get ETH on Base
**Option A: Bridge from Ethereum**
1. Go to https://bridge.base.org/
2. Connect wallet
3. Bridge 0.02+ ETH from Ethereum to Base
4. Wait ~10-20 minutes

**Option B: Buy on Coinbase**
1. Buy ETH on Coinbase
2. Withdraw directly to Base network
3. Select "Base" as network when withdrawing

### 3. ✅ Environment Setup

Create `.env` file:
```bash
cd contracts
cp .env.example .env
```

Edit `.env`:
```env
# Your wallet private key (CRITICAL: Keep secret!)
PRIVATE_KEY=your_actual_private_key_here

# Treasury address (can be same as deployer)
FEE_RECIPIENT=0xYourTreasuryAddress

# Optional: Custom RPC (default uses public endpoint)
BASE_MAINNET_RPC_URL=https://mainnet.base.org

# Get from https://basescan.org/apis
BASESCAN_API_KEY=your_basescan_api_key_here
```

### 4. ✅ Install Dependencies
```bash
npm install
```

### 5. ✅ Compile Contract
```bash
npm run compile
```

### 6. ✅ Run Tests (Optional but Recommended)
```bash
npm test
```

## 🎯 Deployment Steps

### Step 1: Deploy to Base Mainnet
```bash
npm run deploy:base-mainnet-safe
```

This script will:
- ✅ Verify you're on Base Mainnet
- ✅ Check wallet balance
- ✅ Show all deployment parameters
- ✅ Estimate gas costs (~$0.50-2.00)
- ✅ Ask for explicit confirmation
- ✅ Deploy contract
- ✅ Save address to `.env` and `deployments/`
- ✅ Wait for 5 confirmations

**Expected Output:**
```
✅ PollyPoll deployed successfully!
   Contract Address: 0x...
   View on Basescan: https://basescan.org/address/0x...
```

### Step 2: Verify on Basescan
```bash
npm run verify:base
```

Or run the custom verification script:
```bash
node scripts/verify-mainnet.js
```

If automatic verification fails, verify manually at:
https://basescan.org/verifyContract

### Step 3: Test with Small Amount
```bash
# Create your first poll
node scripts/interact-base.js create-poll

# Place a minimal test bet (0.0001 ETH = ~$0.40)
node scripts/interact-base.js place-bet 1 0 0.0001

# Check poll details
node scripts/interact-base.js poll-details 1

# Get protocol stats
node scripts/interact-base.js stats
```

### Step 4: Update Chrome Extension

Update extension configuration:
```javascript
// extension/src/config/contractConfig.js
const CONTRACT_ADDRESS = "0x... // Your deployed address";
const CHAIN_ID = 8453; // Base Mainnet
const RPC_URL = "https://mainnet.base.org";
```

## 📊 Post-Deployment Checklist

### Immediate Actions
- [ ] Contract deployed and verified on Basescan
- [ ] Test transaction successful
- [ ] Contract address saved to `.env`
- [ ] Deployment info saved to `deployments/`
- [ ] Chrome extension updated

### Within 24 Hours
- [ ] Create 2-3 test polls
- [ ] Test all token types (ETH, USDC if available)
- [ ] Test poll resolution
- [ ] Test claiming winnings
- [ ] Monitor gas costs

### Security Checks
- [ ] Remove private key from `.env` after deployment
- [ ] Use hardware wallet for admin functions
- [ ] Set up monitoring alerts on Basescan
- [ ] Document emergency procedures

## 💰 Gas Cost Estimates

| Operation | Gas Units | Cost @ 1 gwei | Cost in USD |
|-----------|-----------|---------------|-------------|
| Deploy Contract | ~3,000,000 | 0.003 ETH | ~$12 |
| Create Poll | ~200,000 | 0.0002 ETH | ~$0.80 |
| Place Bet | ~150,000 | 0.00015 ETH | ~$0.60 |
| Resolve Poll | ~250,000 | 0.00025 ETH | ~$1.00 |
| Claim Winnings | ~100,000 | 0.0001 ETH | ~$0.40 |

*Note: Base typically has 0.1-1 gwei gas prices, making it 10-100x cheaper than Ethereum*

## 🔗 Important Links

- **Base Bridge**: https://bridge.base.org/
- **Basescan**: https://basescan.org/
- **Base Status**: https://status.base.org/
- **Base Docs**: https://docs.base.org/
- **Gas Tracker**: https://basescan.org/gastracker

## 📱 Contract Interaction Commands

### Using Hardhat Console
```bash
npm run console:base

# In console:
const contract = await ethers.getContractAt("PollyPoll", "YOUR_CONTRACT_ADDRESS");
await contract.getProtocolStats();
```

### Using Scripts
```bash
# All mainnet interactions
node scripts/interact-base.js [command]

Commands:
- create-poll
- create-poll-usdc
- create-poll-cbeth
- place-bet <pollId> <option> <amount>
- resolve <pollId>
- claim <pollId>
- stats
- poll-details <pollId>
- user-stats
```

## 🚨 Emergency Procedures

### If Something Goes Wrong

1. **Pause Contract** (if critical):
```javascript
// In console
await contract.pause();
```

2. **Check Contract State**:
```javascript
await contract.getProtocolStats();
await contract.collectedFees("0x0000000000000000000000000000000000000000");
```

3. **Unpause When Fixed**:
```javascript
await contract.unpause();
```

## 📝 Deployment Info Location

After deployment, find your contract details in:
- `deployments/base-mainnet-deployment.json`
- `.env` (CONTRACT_ADDRESS)
- Basescan: https://basescan.org/address/[YOUR_ADDRESS]

## ✅ Success Indicators

You'll know deployment was successful when:
1. Contract appears on Basescan
2. First test transaction succeeds
3. Contract is verified (green checkmark on Basescan)
4. Poll creation works
5. Betting works with small amounts

## 🆘 Support

If you encounter issues:
1. Check transaction on Basescan for revert reasons
2. Ensure sufficient ETH balance
3. Verify network is Base Mainnet (Chain ID: 8453)
4. Check gas price isn't unusually high
5. Confirm all token addresses are correct

---

**Remember**: This is MAINNET with REAL MONEY. Always test with small amounts first!