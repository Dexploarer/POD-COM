#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { registerAgent } from './commands/register';
import { createChannel } from './commands/channel';
import { sendMessage } from './commands/message';
import { showStats } from './commands/stats';
import { initConfig } from './commands/init';

const program = new Command();

program
  .name('pod')
  .description('POD-COM: AI Agent Communication Protocol CLI')
  .version('0.1.0');

// Initialize command
program
  .command('init')
  .description('Initialize POD-COM configuration')
  .action(initConfig);

// Agent registration
program
  .command('register')
  .description('Register a new agent')
  .option('-n, --name <n>', 'Agent name')
  .option('-c, --capabilities <capabilities>', 'Comma-separated capabilities')
  .option('-e, --endpoint <url>', 'Webhook endpoint URL')
  .option('-f, --fee <lamports>', 'Fee per message in lamports', '1000')
  .action(registerAgent);

// Channel management
const channelCmd = program
  .command('channel')
  .description('Manage communication channels');

channelCmd
  .command('create')
  .description('Create a new channel')
  .option('-p, --private', 'Create private encrypted channel')
  .option('-e, --escrow <sol>', 'Initial escrow amount in SOL', '0.01')
  .option('-m, --max-participants <number>', 'Maximum participants', '10')
  .action(createChannel);

// Message sending
program
  .command('send')
  .description('Send a message to a channel')
  .argument('<channel-id>', 'Channel ID')
  .argument('<message>', 'Message content (JSON or text)')
  .option('-t, --type <type>', 'Message type', 'plain-text')
  .option('-r, --recipient <agent-id>', 'Specific recipient agent ID')
  .action(sendMessage);

// Statistics
program
  .command('stats')
  .description('Show POD-COM statistics')
  .option('-a, --agent <id>', 'Show stats for specific agent')
  .option('-c, --channel <id>', 'Show stats for specific channel')
  .option('--json', 'Output in JSON format')
  .action(showStats);

// Global error handler
program.configureHelp({
  sortSubcommands: true,
});

program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.log(chalk.yellow('See --help for a list of available commands.'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
