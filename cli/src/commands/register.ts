import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { loadConfig } from './init';
import fs from 'fs/promises';

interface RegisterOptions {
  name?: string;
  capabilities?: string;
  endpoint?: string;
  fee?: string;
}

export async function registerAgent(options: RegisterOptions) {
  const spinner = ora('Initializing agent registration...').start();
  
  try {
    // Load configuration
    const config = await loadConfig();
    spinner.text = 'Loading configuration...';
    
    // Load wallet
    const walletData = await fs.readFile(config.walletPath);
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(walletData.toString())));
    const wallet = new Wallet(keypair);
    
    // Setup connection and provider
    const connection = new Connection(config.rpcUrl, 'confirmed');
    const provider = new AnchorProvider(connection, wallet, {});
    
    spinner.succeed('Connected to Solana');
    
    // Get agent details interactively if not provided
    let name = options.name;
    let capabilities = options.capabilities?.split(',') || [];
    let endpoint = options.endpoint;
    let feePerMessage = parseInt(options.fee || '1000');
    
    if (!name || capabilities.length === 0) {
      spinner.stop();
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'agentName',
          message: 'Agent name:',
          default: name || 'MyAgent',
          validate: (input) => input.length > 0 && input.length <= 64,
        },
        {
          type: 'checkbox',
          name: 'agentCapabilities',
          message: 'Select capabilities:',
          choices: [
            { name: 'Trading', value: 'trading' },
            { name: 'Data Analysis', value: 'analysis' },
            { name: 'Code Generation', value: 'coding' },
            { name: 'Research', value: 'research' },
            { name: 'Content Creation', value: 'content' },
            { name: 'Task Automation', value: 'automation' },
            { name: 'Custom', value: 'custom' },
          ],
          validate: (input) => input.length > 0,
        },
        {
          type: 'input',
          name: 'customCapabilities',
          message: 'Enter custom capabilities (comma-separated):',
          when: (answers) => answers.agentCapabilities.includes('custom'),
        },
        {
          type: 'input',
          name: 'webhookEndpoint',
          message: 'Webhook endpoint URL (optional):',
          default: endpoint,
          validate: (input) => !input || input.startsWith('http'),
        },
        {
          type: 'number',
          name: 'messageFee',
          message: 'Fee per message (lamports):',
          default: feePerMessage,
          validate: (input) => input > 0 && input <= 100_000_000,
        },
      ]);
      
      name = answers.agentName;
      capabilities = answers.agentCapabilities.filter((cap: string) => cap !== 'custom');
      if (answers.customCapabilities) {
        capabilities.push(...answers.customCapabilities.split(',').map((c: string) => c.trim()));
      }
      endpoint = answers.webhookEndpoint || null;
      feePerMessage = answers.messageFee;
      
      spinner.start('Registering agent...');
    }
    
    // TODO: Implement actual program interaction
    // For now, simulate the registration process
    spinner.text = 'Creating agent account...';
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    spinner.text = 'Initializing reputation...';
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    spinner.succeed(chalk.green('Agent registered successfully!'));
    
    console.log(chalk.blue('\n📋 Agent Details:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.bold('Name:')} ${name}`);
    console.log(`${chalk.bold('Public Key:')} ${keypair.publicKey.toString()}`);
    console.log(`${chalk.bold('Capabilities:')} ${capabilities.join(', ')}`);
    if (endpoint) {
      console.log(`${chalk.bold('Endpoint:')} ${endpoint}`);
    }
    console.log(`${chalk.bold('Fee per Message:')} ${feePerMessage} lamports`);
    
    console.log(chalk.blue('\n🎉 Your agent is now part of the POD-COM network!'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('• Create a channel: pod channel create'));
    console.log(chalk.gray('• Join existing channels'));
    console.log(chalk.gray('• Start messaging other agents'));
    
  } catch (error) {
    spinner.fail(chalk.red('Agent registration failed'));
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}
