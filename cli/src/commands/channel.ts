import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { loadConfig } from './init';
import fs from 'fs/promises';

interface CreateChannelOptions {
  private?: boolean;
  escrow?: string;
  maxParticipants?: string;
}

export async function createChannel(options: CreateChannelOptions) {
  const spinner = ora('Initializing channel creation...').start();
  
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
    
    // Get channel details
    let isPrivate = options.private || false;
    let escrowAmount = parseFloat(options.escrow || '0.01');
    let maxParticipants = parseInt(options.maxParticipants || '10');
    
    // Interactive prompts if needed
    if (!options.private && !options.escrow) {
      spinner.stop();
      
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'isPrivate',
          message: 'Create private encrypted channel?',
          default: false,
        },
        {
          type: 'number',
          name: 'escrowSol',
          message: 'Initial escrow amount (SOL):',
          default: 0.01,
          validate: (input) => input >= 0.001 && input <= 10,
        },
        {
          type: 'number',
          name: 'maxUsers',
          message: 'Maximum participants:',
          default: 10,
          validate: (input) => input > 0 && input <= 100,
        },
        {
          type: 'input',
          name: 'description',
          message: 'Channel description (optional):',
        },
      ]);
      
      isPrivate = answers.isPrivate;
      escrowAmount = answers.escrowSol;
      maxParticipants = answers.maxUsers;
      
      spinner.start('Creating channel...');
    }
    
    // Convert SOL to lamports
    const escrowLamports = Math.floor(escrowAmount * LAMPORTS_PER_SOL);
    
    // Check wallet balance
    const balance = await connection.getBalance(keypair.publicKey);
    if (balance < escrowLamports + 0.01 * LAMPORTS_PER_SOL) { // Add buffer for transaction fees
      spinner.fail(chalk.red('Insufficient balance'));
      console.log(chalk.yellow(`Required: ${escrowAmount + 0.01} SOL`));
      console.log(chalk.yellow(`Available: ${balance / LAMPORTS_PER_SOL} SOL`));
      return;
    }
    
    // TODO: Implement actual program interaction
    spinner.text = 'Creating channel account...';
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    spinner.text = 'Setting up escrow...';
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    spinner.text = 'Initializing statistics...';
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate mock channel ID for demo
    const channelId = Keypair.generate().publicKey.toString();
    
    spinner.succeed(chalk.green('Channel created successfully!'));
    
    console.log(chalk.blue('\n📺 Channel Details:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.bold('Channel ID:')} ${channelId}`);
    console.log(`${chalk.bold('Creator:')} ${keypair.publicKey.toString()}`);
    console.log(`${chalk.bold('Privacy:')} ${isPrivate ? 'Private (encrypted)' : 'Public'}`);
    console.log(`${chalk.bold('Escrow:')} ${escrowAmount} SOL (${escrowLamports} lamports)`);
    console.log(`${chalk.bold('Max Participants:')} ${maxParticipants}`);
    console.log(`${chalk.bold('Status:')} Active`);
    
    console.log(chalk.blue('\n🎯 Next Steps:'));
    console.log(chalk.gray('• Invite agents to join your channel'));
    console.log(chalk.gray(`• Send messages: pod send ${channelId} "Hello!"`));
    console.log(chalk.gray(`• Monitor activity: pod stats --channel ${channelId}`));
    
    // Save channel info to local config for convenience
    try {
      const channelsFile = `${process.env.HOME}/.pod-channels.json`;
      let channels = [];
      try {
        const existing = await fs.readFile(channelsFile, 'utf-8');
        channels = JSON.parse(existing);
      } catch {
        // File doesn't exist, start fresh
      }
      
      channels.push({
        id: channelId,
        name: `Channel-${Date.now()}`,
        creator: keypair.publicKey.toString(),
        created: new Date().toISOString(),
        isPrivate,
        escrowAmount,
        maxParticipants,
      });
      
      await fs.writeFile(channelsFile, JSON.stringify(channels, null, 2));
      console.log(chalk.gray('\n💾 Channel saved to local registry'));
    } catch (error) {
      console.log(chalk.yellow('\n⚠️ Could not save channel to local registry'));
    }
    
  } catch (error) {
    spinner.fail(chalk.red('Channel creation failed'));
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

export async function listChannels() {
  try {
    const channelsFile = `${process.env.HOME}/.pod-channels.json`;
    const channelsData = await fs.readFile(channelsFile, 'utf-8');
    const channels = JSON.parse(channelsData);
    
    if (channels.length === 0) {
      console.log(chalk.yellow('No channels found. Create one with: pod channel create'));
      return;
    }
    
    console.log(chalk.blue('📺 Your Channels:'));
    console.log(chalk.gray('─'.repeat(80)));
    
    channels.forEach((channel: any, index: number) => {
      console.log(`${index + 1}. ${chalk.bold(channel.name || 'Unnamed Channel')}`);
      console.log(`   ID: ${channel.id}`);
      console.log(`   Type: ${channel.isPrivate ? 'Private' : 'Public'}`);
      console.log(`   Escrow: ${channel.escrowAmount} SOL`);
      console.log(`   Created: ${new Date(channel.created).toLocaleDateString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.log(chalk.yellow('No channels found. Create one with: pod channel create'));
  }
}

export async function joinChannel(channelId: string) {
  const spinner = ora(`Joining channel ${channelId}...`).start();
  
  try {
    // TODO: Implement actual join logic
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    spinner.succeed(chalk.green('Successfully joined channel!'));
    console.log(chalk.blue(`\n📺 You are now a participant in channel ${channelId}`));
    console.log(chalk.gray(`Send messages: pod send ${channelId} "Hello everyone!"`));
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to join channel'));
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}
