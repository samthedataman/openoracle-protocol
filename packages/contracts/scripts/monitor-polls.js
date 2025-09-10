// scripts/monitor-polls.js
// Real-time monitoring dashboard for PollyPoll contract

const { ethers } = require("hardhat");
const chalk = require("chalk");
const blessed = require("blessed");
const contrib = require("blessed-contrib");
require("dotenv").config();

class PollMonitor {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.contract = null;
    this.provider = null;
    this.screen = null;
    this.widgets = {};
    this.pollData = new Map();
    this.updateInterval = null;
  }

  async initialize() {
    // Initialize contract
    const [signer] = await ethers.getSigners();
    this.contract = await ethers.getContractAt("PollyPoll", this.contractAddress);
    this.provider = signer.provider;
    
    // Initialize screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'PollyPoll Monitor'
    });
    
    // Create dashboard layout
    this.createDashboard();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start monitoring
    await this.startMonitoring();
  }

  createDashboard() {
    // Create grid
    const grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Contract Status Box (top)
    this.widgets.status = grid.set(0, 0, 2, 12, blessed.box, {
      label: '📊 Contract Status',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true }
      }
    });

    // Active Polls Table (left)
    this.widgets.polls = grid.set(2, 0, 6, 8, contrib.table, {
      label: '🗳️ Active Polls',
      columnSpacing: 2,
      columnWidth: [4, 30, 10, 10, 8],
      style: {
        border: { fg: 'cyan' },
        header: { fg: 'yellow', bold: true }
      }
    });

    // Contract Balance Chart (right top)
    this.widgets.balanceChart = grid.set(2, 8, 3, 4, contrib.line, {
      label: '💰 Contract Balance (ETH)',
      showLegend: false,
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'white',
        border: { fg: 'cyan' }
      }
    });

    // Recent Events Log (right bottom)
    this.widgets.events = grid.set(5, 8, 3, 4, blessed.log, {
      label: '📝 Recent Events',
      border: { type: 'line' },
      scrollable: true,
      alwaysScroll: true,
      style: {
        border: { fg: 'cyan' }
      }
    });

    // Poll Details (bottom)
    this.widgets.details = grid.set(8, 0, 4, 8, blessed.box, {
      label: '📋 Selected Poll Details',
      border: { type: 'line' },
      scrollable: true,
      style: {
        border: { fg: 'cyan' }
      }
    });

    // Statistics (bottom right)
    this.widgets.stats = grid.set(8, 8, 4, 4, blessed.box, {
      label: '📈 Statistics',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' }
      }
    });

    // Quit on q or ESC
    this.screen.key(['q', 'C-c', 'escape'], () => {
      this.stopMonitoring();
      process.exit(0);
    });

    this.screen.render();
  }

  async updateContractStatus() {
    try {
      // Get contract balance
      const balance = await this.provider.getBalance(this.contractAddress);
      const balanceETH = ethers.utils.formatEther(balance);
      const balanceUSD = (parseFloat(balanceETH) * 4000).toFixed(2);
      
      // Get protocol stats
      const stats = await this.contract.getProtocolStats();
      
      // Get fee balance
      const ethFees = await this.contract.collectedFees("0x0000000000000000000000000000000000000000");
      
      // Update status widget
      const statusText = [
        `{yellow-fg}Contract:{/} ${this.contractAddress.slice(0, 10)}...`,
        `{yellow-fg}Balance:{/} ${balanceETH} ETH ($${balanceUSD})`,
        `{yellow-fg}Total Polls:{/} ${stats.totalPolls} | {yellow-fg}Active:{/} ${stats.activePollsCount}`,
        `{yellow-fg}Total Bets:{/} ${stats.totalBets} | {yellow-fg}Volume:{/} ${ethers.utils.formatEther(stats.totalVolume)} ETH`,
        `{yellow-fg}Collected Fees:{/} ${ethers.utils.formatEther(ethFees)} ETH`
      ].join('\n');
      
      this.widgets.status.setContent(statusText);
      
      // Update balance chart
      this.updateBalanceChart(parseFloat(balanceETH));
      
    } catch (error) {
      this.widgets.status.setContent(`{red-fg}Error: ${error.message}{/}`);
    }
  }

  async updateActivePolls() {
    try {
      const stats = await this.contract.getProtocolStats();
      const totalPolls = stats.totalPolls.toNumber();
      
      const pollsData = [];
      const now = Math.floor(Date.now() / 1000);
      
      for (let i = 1; i <= totalPolls; i++) {
        try {
          const details = await this.contract.getPollDetails(i, ethers.constants.AddressZero);
          
          if (!details.resolved && details.endTime.gt(now)) {
            const timeRemaining = details.endTime.sub(now);
            const hours = Math.floor(timeRemaining / 3600);
            const minutes = Math.floor((timeRemaining % 3600) / 60);
            
            pollsData.push([
              i.toString(),
              details.question.slice(0, 30) + (details.question.length > 30 ? '...' : ''),
              `${ethers.utils.formatEther(details.totalPool)} ${details.tokenSymbol}`,
              `${details.participantCount}`,
              `${hours}h ${minutes}m`
            ]);
            
            // Store poll data for details view
            this.pollData.set(i, details);
          }
        } catch (e) {
          continue;
        }
      }
      
      // Update polls table
      this.widgets.polls.setData({
        headers: ['ID', 'Question', 'Pool', 'Voters', 'Time Left'],
        data: pollsData
      });
      
    } catch (error) {
      this.widgets.polls.setData({
        headers: ['Error'],
        data: [[error.message]]
      });
    }
  }

  updateBalanceChart(currentBalance) {
    if (!this.balanceHistory) {
      this.balanceHistory = [];
    }
    
    // Keep last 20 data points
    this.balanceHistory.push(currentBalance);
    if (this.balanceHistory.length > 20) {
      this.balanceHistory.shift();
    }
    
    // Create x-axis labels (time)
    const xLabels = this.balanceHistory.map((_, i) => i.toString());
    
    this.widgets.balanceChart.setData([{
      x: xLabels,
      y: this.balanceHistory,
      style: { line: 'yellow' }
    }]);
  }

  async updateStatistics() {
    try {
      const stats = await this.contract.getProtocolStats();
      
      // Calculate average bet size
      const avgBet = stats.totalBets.gt(0) 
        ? ethers.utils.formatEther(stats.totalVolume.div(stats.totalBets))
        : "0";
      
      // Get token volumes
      const ethVolume = await this.contract.getTokenVolume("0x0000000000000000000000000000000000000000");
      
      const statsText = [
        `{yellow-fg}Total Polls Created:{/} ${stats.totalPolls}`,
        `{yellow-fg}Total Bets Placed:{/} ${stats.totalBets}`,
        `{yellow-fg}Active Polls:{/} ${stats.activePollsCount}`,
        ``,
        `{cyan-fg}Volume Statistics:{/}`,
        `{yellow-fg}Total Volume:{/} ${ethers.utils.formatEther(stats.totalVolume)} ETH`,
        `{yellow-fg}ETH Volume:{/} ${ethers.utils.formatEther(ethVolume)} ETH`,
        `{yellow-fg}Avg Bet Size:{/} ${avgBet} ETH`,
        ``,
        `{green-fg}Updated:{/} ${new Date().toLocaleTimeString()}`
      ].join('\n');
      
      this.widgets.stats.setContent(statsText);
      
    } catch (error) {
      this.widgets.stats.setContent(`{red-fg}Error: ${error.message}{/}`);
    }
  }

  setupEventListeners() {
    // Listen to contract events
    this.contract.on("PollCreated", (pollId, articleUrl, question, creator, endTime) => {
      this.widgets.events.log(`{green-fg}[NEW POLL]{/} #${pollId}: ${question.slice(0, 30)}...`);
      this.updateActivePolls();
    });

    this.contract.on("BetPlaced", (pollId, user, option, amount, weightedAmount) => {
      const amountETH = ethers.utils.formatEther(amount);
      this.widgets.events.log(`{yellow-fg}[BET]{/} Poll #${pollId}: ${amountETH} ETH on option ${option}`);
      this.updateActivePolls();
      this.updateContractStatus();
    });

    this.contract.on("PollResolved", (pollId, winningOption, totalPool, platformFee) => {
      this.widgets.events.log(`{cyan-fg}[RESOLVED]{/} Poll #${pollId}: Option ${winningOption} wins!`);
      this.updateActivePolls();
    });

    this.contract.on("WinningsClaimed", (pollId, user, amount) => {
      const amountETH = ethers.utils.formatEther(amount);
      this.widgets.events.log(`{magenta-fg}[CLAIM]{/} Poll #${pollId}: ${amountETH} ETH claimed`);
      this.updateContractStatus();
    });

    // Poll selection
    this.widgets.polls.rows.on('select', (item) => {
      const pollId = parseInt(item.content.split(' ')[0]);
      this.showPollDetails(pollId);
    });

    // Allow scrolling in details
    this.widgets.details.key(['up', 'down'], (ch, key) => {
      if (key.name === 'up') {
        this.widgets.details.scroll(-1);
      } else {
        this.widgets.details.scroll(1);
      }
      this.screen.render();
    });
  }

  showPollDetails(pollId) {
    const details = this.pollData.get(pollId);
    if (!details) return;
    
    const detailsText = [
      `{cyan-fg}Poll ID:{/} ${pollId}`,
      `{cyan-fg}Question:{/} ${details.question}`,
      `{cyan-fg}Token:{/} ${details.tokenSymbol}`,
      `{cyan-fg}Total Pool:{/} ${ethers.utils.formatEther(details.totalPool)} ${details.tokenSymbol}`,
      `{cyan-fg}Participants:{/} ${details.participantCount}`,
      ``,
      `{yellow-fg}Options:{/}`
    ];
    
    for (let i = 0; i < details.options.length; i++) {
      const pool = ethers.utils.formatEther(details.optionPools[i]);
      const percentage = details.totalPool.gt(0)
        ? details.optionPools[i].mul(100).div(details.totalPool).toString()
        : "0";
      
      detailsText.push(`  [${i}] ${details.options[i]}`);
      detailsText.push(`      Pool: ${pool} ${details.tokenSymbol} (${percentage}%)`);
    }
    
    this.widgets.details.setContent(detailsText.join('\n'));
    this.screen.render();
  }

  async startMonitoring() {
    // Initial update
    await this.updateAll();
    
    // Set up refresh interval (5 seconds)
    this.updateInterval = setInterval(async () => {
      await this.updateAll();
    }, 5000);
    
    // Log start
    this.widgets.events.log(`{green-fg}[SYSTEM]{/} Monitoring started at ${new Date().toLocaleTimeString()}`);
  }

  async updateAll() {
    await this.updateContractStatus();
    await this.updateActivePolls();
    await this.updateStatistics();
    this.screen.render();
  }

  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Remove event listeners
    this.contract.removeAllListeners();
  }
}

// Simple monitoring mode (without blessed dashboard)
async function simpleMonitor(contractAddress) {
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("PollyPoll", contractAddress);
  const provider = signer.provider;
  
  console.log(chalk.cyan.bold("📊 PollyPoll Simple Monitor"));
  console.log(chalk.gray("Updates every 10 seconds. Press Ctrl+C to stop.\n"));
  
  const update = async () => {
    console.clear();
    console.log(chalk.cyan.bold("📊 PollyPoll Contract Monitor"));
    console.log(chalk.gray("━".repeat(50)));
    console.log(chalk.gray(`Time: ${new Date().toLocaleString()}\n`));
    
    // Contract balance
    const balance = await provider.getBalance(contractAddress);
    console.log(chalk.yellow(`💰 Contract Balance: ${ethers.utils.formatEther(balance)} ETH\n`));
    
    // Protocol stats
    const stats = await contract.getProtocolStats();
    console.log(chalk.white(`📊 Statistics:`));
    console.log(chalk.gray(`   Total Polls: ${stats.totalPolls}`));
    console.log(chalk.gray(`   Active Polls: ${stats.activePollsCount}`));
    console.log(chalk.gray(`   Total Bets: ${stats.totalBets}`));
    console.log(chalk.gray(`   Total Volume: ${ethers.utils.formatEther(stats.totalVolume)} ETH\n`));
    
    // Active polls
    console.log(chalk.white(`🗳️ Active Polls:`));
    const totalPolls = stats.totalPolls.toNumber();
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 1; i <= totalPolls && i <= 10; i++) {
      try {
        const details = await contract.getPollDetails(i, ethers.constants.AddressZero);
        
        if (!details.resolved && details.endTime.gt(now)) {
          const timeRemaining = details.endTime.sub(now);
          const hours = Math.floor(timeRemaining / 3600);
          const minutes = Math.floor((timeRemaining % 3600) / 60);
          
          console.log(chalk.blue(`\n   Poll #${i}: "${details.question.slice(0, 50)}..."`));
          console.log(chalk.gray(`   Pool: ${ethers.utils.formatEther(details.totalPool)} ${details.tokenSymbol} | Voters: ${details.participantCount} | Time: ${hours}h ${minutes}m`));
          
          // Show options
          for (let j = 0; j < details.options.length; j++) {
            const pool = ethers.utils.formatEther(details.optionPools[j]);
            const percentage = details.totalPool.gt(0)
              ? details.optionPools[j].mul(100).div(details.totalPool).toString()
              : "0";
            console.log(chalk.gray(`     [${j}] ${details.options[j]}: ${pool} ${details.tokenSymbol} (${percentage}%)`));
          }
        }
      } catch (e) {
        continue;
      }
    }
  };
  
  // Initial update
  await update();
  
  // Set interval
  setInterval(update, 10000);
}

// Main execution
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.log(chalk.red("❌ CONTRACT_ADDRESS not set in .env"));
    process.exit(1);
  }
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args[0] === "simple") {
    // Run simple monitor (no dashboard)
    await simpleMonitor(contractAddress);
  } else {
    // Run full dashboard
    try {
      const monitor = new PollMonitor(contractAddress);
      await monitor.initialize();
    } catch (error) {
      // If blessed fails, fall back to simple monitor
      console.log(chalk.yellow("Dashboard unavailable, using simple monitor...\n"));
      await simpleMonitor(contractAddress);
    }
  }
}

main().catch((error) => {
  console.error(chalk.red("Error:"), error);
  process.exit(1);
});