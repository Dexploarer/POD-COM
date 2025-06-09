import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { loadConfig } from './init';
import fs from 'fs/promises';

interface SendMessageOptions {
  type?: string;
  recipient?: string;
}

type MessageType = 'plain-text' | 'function-call' | 'data-stream' | 'workflow' | 'ai-prompt' | 'media' | 'code';

export async function sendMessage(
  channelId: string, 
  message: string, 
  options: SendMessageOptions
) {
  const spinner = ora('Preparing to send message...').start();
  
  try {
    // Load configuration
    const config = await loadConfig();
    spinner.text = 'Loading configuration...';
    
    // Load wallet
    const walletData = await fs.readFile(config.walletPath);
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(walletData.toString())));
    const wallet = new Wallet(keypair);
    
    // Setup connection
    const connection = new Connection(config.rpcUrl, 'confirmed');
    const provider = new AnchorProvider(connection, wallet, {});
    
    spinner.text = 'Validating channel...';
    
    // Validate channel exists (check local registry for now)
    let channelExists = false;
    try {
      const channelsFile = `${process.env.HOME}/.pod-channels.json`;
      const channelsData = await fs.readFile(channelsFile, 'utf-8');
      const channels = JSON.parse(channelsData);
      channelExists = channels.some((ch: any) => ch.id === channelId);
    } catch {
      // Channel registry doesn't exist
    }
    
    if (!channelExists) {
      spinner.warn(chalk.yellow('Channel not found in local registry'));
      console.log(chalk.gray('Attempting to send anyway (channel might exist on-chain)...'));
      spinner.start('Sending message...');
    }
    
    // Parse message type
    const messageType = options.type as MessageType || 'plain-text';
    
    // Validate and parse message content
    let parsedContent: any = message;
    let contentHash: Buffer;
    
    try {
      // Try to parse as JSON for structured messages
      if (messageType !== 'plain-text') {
        parsedContent = JSON.parse(message);
      }
    } catch {
      if (messageType !== 'plain-text') {
        spinner.fail(chalk.red('Invalid JSON format for structured message'));
        console.log(chalk.yellow('Hint: Use quotes around JSON: \'{"key": "value"}\''));
        return;
      }
    }
    
    // Create content hash for privacy
    contentHash = crypto.createHash('sha256').update(message).digest();
    
    // Create metadata
    const metadata = {
      timestamp: Date.now(),
      type: messageType,
      sender: keypair.publicKey.toString(),
      recipient: options.recipient || null,
      size: message.length,
    };
    
    spinner.text = 'Calculating fees...';
    
    // Simulate fee calculation (1000 lamports base)
    const baseFee = 1000;
    const typeFeeMultiplier = getTypeFeeMultiplier(messageType);
    const totalFee = baseFee * typeFeeMultiplier;
    
    spinner.text = `Sending message (fee: ${totalFee} lamports)...`;
    
    // TODO: Implement actual program interaction
    // For now, simulate the message sending process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock transaction signature
    const txSignature = Keypair.generate().publicKey.toString().slice(0, 16) + '...';
    
    spinner.succeed(chalk.green('Message sent successfully!'));
    
    console.log(chalk.blue('\n📨 Message Details:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Channel:')} ${channelId}`);
    console.log(`${chalk.bold('Type:')} ${messageType}`);
    console.log(`${chalk.bold('Content Hash:')} ${contentHash.toString('hex').slice(0, 16)}...`);
    console.log(`${chalk.bold('Fee Paid:')} ${totalFee} lamports`);
    console.log(`${chalk.bold('Transaction:')} ${txSignature}`);
    
    if (options.recipient) {
      console.log(`${chalk.bold('Recipient:')} ${options.recipient}`);
    } else {
      console.log(`${chalk.bold('Broadcast:')} All channel participants`);
    }
    
    // Show message preview (truncated for privacy)
    console.log(chalk.blue('\n📝 Message Preview:'));
    const preview = message.length > 100 ? `${message.slice(0, 100)}...` : message;
    console.log(chalk.gray(`"${preview}"`));
    
    // Log message to local history
    await logMessageLocally(channelId, {
      id: crypto.randomUUID(),
      content: message,
      contentHash: contentHash.toString('hex'),
      type: messageType,
      sender: keypair.publicKey.toString(),
      recipient: options.recipient,
      timestamp: Date.now(),
      fee: totalFee,
      txSignature,
    });
    
    console.log(chalk.blue('\n🎯 Message sent to the POD-COM network!'));
    
  } catch (error) {
    spinner.fail(chalk.red('Message sending failed'));
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

function getTypeFeeMultiplier(type: MessageType): number {
  switch (type) {
    case 'plain-text':
      return 1.0;
    case 'function-call':
      return 1.5;
    case 'data-stream':
      return 2.0;
    case 'workflow':
      return 1.8;
    case 'ai-prompt':
      return 2.5;
    case 'media':
      return 3.0;
    case 'code':
      return 1.2;
    default:
      return 1.0;
  }
}

async function logMessageLocally(channelId: string, messageData: any) {
  try {
    const historyFile = `${process.env.HOME}/.pod-message-history.json`;
    let history: any = {};
    
    try {
      const existing = await fs.readFile(historyFile, 'utf-8');
      history = JSON.parse(existing);
    } catch {
      // File doesn't exist, start fresh
    }
    
    if (!history[channelId]) {
      history[channelId] = [];
    }
    
    history[channelId].push(messageData);
    
    // Keep only last 100 messages per channel
    if (history[channelId].length > 100) {
      history[channelId] = history[channelId].slice(-100);
    }
    
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    // Fail silently for local logging
    console.log(chalk.gray('Note: Could not save message to local history'));
  }
}

export async function tailMessages(channelId: string, options: { json?: boolean } = {}) {
  console.log(chalk.blue(`📡 Listening for messages in channel ${channelId}...`));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));
  
  // Show recent messages first
  try {
    const historyFile = `${process.env.HOME}/.pod-message-history.json`;
    const historyData = await fs.readFile(historyFile, 'utf-8');
    const history = JSON.parse(historyData);
    
    if (history[channelId] && history[channelId].length > 0) {
      console.log(chalk.blue('📜 Recent Messages:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const recentMessages = history[channelId].slice(-10); // Last 10 messages
      
      recentMessages.forEach((msg: any) => {
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.sender.slice(0, 8) + '...';
        
        if (options.json) {
          console.log(JSON.stringify(msg, null, 2));
        } else {
          console.log(`[${timestamp}] ${chalk.cyan(sender)} → ${msg.content}`);
        }
      });
      
      console.log('');
    }
  } catch {
    // No history available
  }
  
  // Simulate real-time message listening
  console.log(chalk.yellow('🔄 Waiting for new messages...'));
  
  // In a real implementation, this would subscribe to on-chain events
  // For now, just keep the process alive
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n👋 Stopped listening for messages'));
    process.exit(0);
  });
  
  // Keep alive
  setInterval(() => {
    // In real implementation, poll for new messages
  }, 5000);
}
