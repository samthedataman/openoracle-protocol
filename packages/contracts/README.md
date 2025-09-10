# 📜 PollyPoll Smart Contracts

Smart contracts for the PollyPoll prediction market platform on **Base Ethereum L2**.

## 🎯 Overview

PollyPoll transforms news article polls into prediction markets where users can bet ETH, USDC, PYUSD, or cbETH on outcomes. Winners split the pool with time-based bonuses for early participants. Deployed on Base for ultra-low gas costs.

## 🏗️ Architecture

### Core Contract: `PollyPoll.sol`

**Key Features:**
- 🎰 **Multi-Token Markets**: Bet with ETH, USDC, PYUSD, or cbETH on Base
- ⏰ **Time Bonuses**: Early voters get multipliers (1.5x → 1.3x → 1.1x → 1.0x)
- 💰 **Winner Takes Pool**: Winners split pool minus 2.5% platform fee + 0.5% creator reward
- 🛡️ **Security**: ReentrancyGuard, SafeERC20, Pausable, input validation
- 📊 **Flexible Duration**: Polls run 24-96 hours (configurable)
- 🚫 **Anti-Spam**: Maximum 10 polls per day
- ⚡ **Base L2**: Ultra-low gas costs (~$0.10-0.25 per transaction)

### Betting Mechanics

1. **Create Poll**: Anyone can create a poll for an article (max 10/day)
2. **Place Bets**: Users bet on their chosen option:
   - ETH: 0.0001-0.1 ETH
   - USDC/PYUSD: 1-10,000 USDC/PYUSD
   - cbETH: 0.0001-0.1 cbETH
3. **Time Bonuses**:
   - 0-10% of duration: 1.5x multiplier
   - 10-30% of duration: 1.3x multiplier
   - 30-60% of duration: 1.1x multiplier
   - 60-100% of duration: 1.0x multiplier
4. **Resolution**: After poll duration (24-96h), option with most money wins
5. **Claim Winnings**: Winners claim their share based on weighted contribution

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- NPM or Yarn
- MetaMask wallet
- Base Sepolia ETH (get from [faucet](https://www.coinbase.com/faucets))

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your private key
nano .env
```

### Compile Contracts

```bash
npm run compile
```

### Deploy to Base Sepolia Testnet

```bash
npm run deploy:base-sepolia
```

### Deploy to Base Mainnet

```bash
npm run deploy:base
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with gas reporting
npx hardhat test --gas-reporter

# Run coverage analysis
npm run coverage
```

## 📝 Contract Functions

### User Functions

#### `createPoll(articleUrl, question, options, paymentToken, durationHours)`
Create a new prediction market poll.

```javascript
const tx = await contract.createPoll(
  "https://news.com/article",
  "Will this happen?",
  ["Yes", "No", "Maybe"],
  "0x0000000000000000000000000000000000000000", // ETH
  48 // 48 hours
);
```

#### `placeBetETH(pollId, option)` / `placeBetToken(pollId, option, amount)`
Place a bet on a poll option.

```javascript
// For ETH polls
const tx = await contract.placeBetETH(1, 0, {
  value: ethers.utils.parseEther("0.01") // Bet 0.01 ETH
});

// For USDC/PYUSD polls
const tx = await contract.placeBetToken(1, 0, 
  ethers.utils.parseUnits("10", 6) // Bet 10 USDC
);
```

#### `claimWinnings(pollId)`
Claim winnings after poll resolution.

```javascript
const tx = await contract.claimWinnings(1);
```

### View Functions

#### `getPollDetails(pollId, userAddress)`
Get comprehensive poll information.

```javascript
const details = await contract.getPollDetails(1, userAddress);
console.log("Total pool:", details.totalPool);
console.log("Your bet:", details.userAmount);
```

#### `getCurrentMultiplier(pollId)`
Get current time bonus multiplier.

```javascript
const multiplier = await contract.getCurrentMultiplier(1);
console.log("Current bonus:", multiplier / 10000 + "x");
```

#### `calculatePotentialWinnings(pollId, userAddress)`
Calculate potential winnings if your option wins.

```javascript
const winnings = await contract.calculatePotentialWinnings(1, userAddress);
console.log("Potential winnings:", ethers.utils.formatEther(winnings));
```

## 🔗 Network Configuration

### Base Sepolia Testnet
- **Chain ID**: 84532 (0x14A34)
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org/
- **Faucet**: https://www.coinbase.com/faucets
- **Bridge**: https://bridge.base.org/

### Base Mainnet
- **Chain ID**: 8453 (0x2105)
- **RPC URL**: https://mainnet.base.org
- **Explorer**: https://basescan.org/
- **Bridge**: https://bridge.base.org/

## 💰 Token Addresses (Base Mainnet)

| Token | Address |
|-------|---------|  
| ETH | `0x0000000000000000000000000000000000000000` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| PYUSD | `0xCaA940D48b22B8f3fb53b7d5EB0a0e43Bc261D3c` |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` |

## 📊 Contract Events

```solidity
event PollCreated(uint256 pollId, string articleUrl, string question, address creator, uint256 endTime);
event BetPlaced(uint256 pollId, address user, uint8 option, uint256 amount, uint256 weightedAmount);
event PollResolved(uint256 pollId, uint8 winningOption, uint256 totalPool, uint256 platformFee);
event WinningsClaimed(uint256 pollId, address user, uint256 amount);
```

## 🛠️ Development Scripts

### Interact with Deployed Contract

```bash
# Create a poll
npm run create-poll

# Place a bet
npx hardhat run scripts/interact.js --network baseSepolia bet <pollId> <option> <amount>

# Check poll details
npx hardhat run scripts/interact.js --network baseSepolia details <pollId>

# Resolve a poll (after duration ends)
npx hardhat run scripts/interact.js --network baseSepolia resolve <pollId>

# Claim winnings
npx hardhat run scripts/interact.js --network baseSepolia claim <pollId>

# Check current multiplier
npx hardhat run scripts/interact.js --network baseSepolia multiplier <pollId>

# Base-specific interactions
node scripts/interact-base.js create-poll-usdc  # Create USDC poll
node scripts/interact-base.js create-poll-cbeth # Create cbETH poll
node scripts/interact-base.js stats            # Get protocol stats
```

### Hardhat Console

```bash
# Interactive console
npm run console:base-sepolia  # For testnet
npm run console:base         # For mainnet

# In console:
const Contract = await ethers.getContractFactory("PollyPoll");
const contract = await Contract.attach(process.env.CONTRACT_ADDRESS);
await contract.getProtocolStats();
```

## 🔐 Security Considerations

1. **ReentrancyGuard**: Prevents reentrancy attacks on payment functions
2. **SafeERC20**: Safe token transfer handling
3. **Pausable**: Emergency stop mechanism
4. **Input Validation**: Strict validation of all user inputs
5. **Time Locks**: Polls can only be resolved after ending
6. **Access Control**: Admin functions restricted to owner
7. **Division Protection**: Safeguards against division by zero
8. **Tie Resolution**: Automatic random tie-breaking

## 📈 Gas Costs on Base

Typical transaction costs (at 1 gwei gas price):
- **Create Poll**: ~200,000 gas (~$0.20)
- **Place Bet**: ~150,000 gas (~$0.15)
- **Resolve Poll**: ~250,000 gas (~$0.25)
- **Claim Winnings**: ~100,000 gas (~$0.10)
- **Batch Claim (3 polls)**: ~250,000 gas (~$0.25)

*Base L2 offers 10-100x lower costs than Ethereum mainnet*

## 🗺️ Roadmap

- [x] Multi-token betting support (ETH, USDC, PYUSD, cbETH)
- [x] Flexible poll duration (24-96 hours)
- [x] Creator rewards system
- [ ] Dynamic fee adjustments
- [ ] Governance token integration
- [ ] Cross-chain bridge support
- [ ] Advanced analytics dashboard
- [ ] Automated market makers
- [ ] Integration with Coinbase Wallet
- [ ] Base Name Service (BNS) integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📜 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: [PollyPoll Docs](https://docs.pollypoll.app)
- **Discord**: [Join our community](https://discord.gg/pollypoll)
- **GitHub Issues**: [Report bugs](https://github.com/pollypoll/contracts/issues)

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Always audit contracts before mainnet deployment.