#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { OpenOracleAPI } from './api/oracle-api';
import { OracleConfig } from './core/config';

const program = new Command();

program
  .name('openoracle')
  .description('OpenOracle CLI - Intelligent Oracle Routing for Prediction Markets')
  .version('0.1.0');

// Route command
program
  .command('route')
  .description('Route a question to the best oracle')
  .argument('<question>', 'Question to route')
  .option('-c, --category <category>', 'Category hint (price, sports, weather, etc.)')
  .option('-p, --providers <providers>', 'Preferred providers (comma-separated)', (value) => value.split(','))
  .option('--max-cost <cost>', 'Maximum cost in USD', parseFloat)
  .option('--max-latency <ms>', 'Maximum latency in milliseconds', parseInt)
  .action(async (question, options) => {
    const spinner = ora('Routing question to optimal oracle...').start();
    
    try {
      const config = OracleConfig.fromEnv();
      const api = new OpenOracleAPI(config);
      
      const result = await api.routeQuestion(question, {
        categoryHint: options.category,
        preferredProviders: options.providers,
        maxCostUsd: options.maxCost,
        maxLatencyMs: options.maxLatency
      });
      
      spinner.succeed('Question routed successfully!');
      
      console.log(boxen(
        `${chalk.bold('Oracle Selected:')} ${result.selectedOracle?.value || 'None'}\n` +
        `${chalk.bold('Confidence:')} ${(result.confidenceScore * 100).toFixed(1)}%\n` +
        `${chalk.bold('Reasoning:')} ${result.reasoning}` +
        (result.estimatedCostUsd ? `\n${chalk.bold('Estimated Cost:')} $${result.estimatedCostUsd}` : '') +
        (result.estimatedLatencyMs ? `\n${chalk.bold('Estimated Latency:')} ${result.estimatedLatencyMs}ms` : ''),
        { padding: 1, borderColor: 'green' }
      ));
      
    } catch (error) {
      spinner.fail('Failed to route question');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Price command
program
  .command('price')
  .description('Get current price for an asset')
  .argument('<symbol>', 'Asset symbol (e.g., BTC/USD)')
  .option('-p, --provider <provider>', 'Specific provider to use')
  .action(async (symbol, options) => {
    const spinner = ora(`Fetching ${symbol} price...`).start();
    
    try {
      const config = OracleConfig.fromEnv();
      const api = new OpenOracleAPI(config);
      
      const result = await api.getPrice(symbol, {
        provider: options.provider
      });
      
      spinner.succeed(`${symbol} price fetched!`);
      
      console.log(boxen(
        `${chalk.bold('Symbol:')} ${result.symbol}\n` +
        `${chalk.bold('Price:')} $${result.price}\n` +
        `${chalk.bold('Source:')} ${result.source}\n` +
        `${chalk.bold('Updated:')} ${new Date(result.timestamp).toLocaleString()}`,
        { padding: 1, borderColor: 'blue' }
      ));
      
    } catch (error) {
      spinner.fail('Failed to fetch price');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Tweet analysis command
program
  .command('tweet')
  .description('Analyze a tweet for prediction potential')
  .argument('<text>', 'Tweet text to analyze')
  .option('-a, --author <author>', 'Tweet author handle')
  .action(async (text, options) => {
    const spinner = ora('Analyzing tweet for predictions...').start();
    
    try {
      const config = OracleConfig.fromEnv();
      const api = new OpenOracleAPI(config);
      
      const result = await api.analyzeTweet({
        tweetText: text,
        author: options.author
      });
      
      spinner.succeed('Tweet analyzed!');
      
      console.log(boxen(
        `${chalk.bold('Has Prediction:')} ${result.hasPrediction ? 'Yes' : 'No'}\n` +
        `${chalk.bold('Confidence:')} ${(result.confidence * 100).toFixed(1)}%\n` +
        `${chalk.bold('Type:')} ${result.predictionType}\n` +
        (result.suggestedQuestion ? `${chalk.bold('Suggested Question:')} ${result.suggestedQuestion}\n` : '') +
        `${chalk.bold('Market Interest:')} ${result.estimatedInterest}`,
        { padding: 1, borderColor: 'yellow' }
      ));
      
    } catch (error) {
      spinner.fail('Failed to analyze tweet');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Health check command
program
  .command('health')
  .description('Check oracle health status')
  .action(async () => {
    const spinner = ora('Checking oracle health...').start();
    
    try {
      const config = OracleConfig.fromEnv();
      const api = new OpenOracleAPI(config);
      
      const health = await api.getOracleHealth();
      
      spinner.succeed('Health check completed!');
      
      Object.entries(health).forEach(([oracle, status]) => {
        const statusColor = status.status === 'healthy' ? 'green' : status.status === 'degraded' ? 'yellow' : 'red';
        console.log(`${chalk.bold(oracle.toUpperCase())}: ${chalk[statusColor](status.status)} (${status.uptime}% uptime)`);
      });
      
    } catch (error) {
      spinner.fail('Health check failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Create market command
program
  .command('create-market')
  .description('Create a prediction market')
  .argument('<question>', 'Market question')
  .option('-i, --poll-id <id>', 'Poll ID for the market')
  .option('-c, --category <category>', 'Market category')
  .action(async (question, options) => {
    const spinner = ora('Creating prediction market...').start();
    
    try {
      const config = OracleConfig.fromEnv();
      const api = new OpenOracleAPI(config);
      
      const result = await api.createPredictionMarket({
        question,
        pollId: options.pollId || `market-${Date.now()}`,
        category: options.category
      });
      
      spinner.succeed('Market created successfully!');
      
      console.log(boxen(
        `${chalk.bold('Market ID:')} ${result.pollId}\n` +
        `${chalk.bold('Question:')} ${result.question}\n` +
        `${chalk.bold('Oracle:')} ${result.oracle}\n` +
        `${chalk.bold('Status:')} ${result.status}`,
        { padding: 1, borderColor: 'magenta' }
      ));
      
    } catch (error) {
      spinner.fail('Failed to create market');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const config = OracleConfig.fromEnv();
    
    console.log(boxen(
      `${chalk.bold('API Base URL:')} ${config.baseUrl}\n` +
      `${chalk.bold('Timeout:')} ${config.timeout}ms\n` +
      `${chalk.bold('Retries:')} ${config.retries}\n` +
      `${chalk.bold('Environment:')} ${config.environment}\n` +
      `${chalk.bold('AI Routing:')} ${config.enableAiRouting ? 'Enabled' : 'Disabled'}`,
      { padding: 1, borderColor: 'cyan' }
    ));
  });

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}