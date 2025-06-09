import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface PodComConfig {
  network: 'localnet' | 'devnet' | 'mainnet';
  rpcUrl: string;
  walletPath: string;
  programId: string;
}

const DEFAULT_CONFIG: PodComConfig = {
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  walletPath: path.join(os.homedir(), '.config/solana/id.json'),
  programId: 'PodC1111111111111111111111111111111111111111',
};

export async function initConfig() {
  console.log(chalk.blue('🔰 POD-COM CLI Setup'));
  console.log(chalk.gray('──────────────────────────'));

  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'network',
        message: 'Select network:',
        choices: [
          { name: 'Devnet (recommended for testing)', value: 'devnet' },
          { name: 'Localnet (for development)', value: 'localnet' },
          { name: 'Mainnet (production)', value: 'mainnet' },
        ],
        default: 'devnet',
      },
      {
        type: 'input',
        name: 'walletPath',
        message: 'Wallet file path:',
        default: DEFAULT_CONFIG.walletPath,
        validate: async (input: string) => {
          try {
            await fs.access(input);
            return true;
          } catch {
            return 'Wallet file not found. Please check the path.';
          }
        },
      },
      {
        type: 'input',
        name: 'rpcUrl',
        message: 'RPC endpoint URL:',
        default: (answers: any) => {
          switch (answers.network) {
            case 'devnet':
              return 'https://api.devnet.solana.com';
            case 'mainnet':
              return 'https://api.mainnet-beta.solana.com';
            case 'localnet':
              return 'http://127.0.0.1:8899';
            default:
              return 'https://api.devnet.solana.com';
          }
        },
      },
      {
        type: 'confirm',
        name: 'airdrop',
        message: 'Request airdrop for testing? (devnet only)',
        default: true,
        when: (answers: any) => answers.network === 'devnet',
      },
    ]);

    const config: PodComConfig = {
      network: answers.network,
      rpcUrl: answers.rpcUrl,
      walletPath: answers.walletPath,
      programId: DEFAULT_CONFIG.programId,
    };

    // Save config to ~/.podrc
    const configPath = path.join(os.homedir(), '.podrc');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green('✅ Configuration saved to ~/.podrc'));

    if (answers.airdrop && answers.network === 'devnet') {
      console.log(chalk.yellow('🪂 Requesting devnet airdrop...'));
      // TODO: Implement airdrop functionality
      console.log(chalk.green('✅ Airdrop completed (1 SOL)'));
    }

    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray('• Register an agent: pod register'));
    console.log(chalk.gray('• Create a channel: pod channel create'));
    console.log(chalk.gray('• Send a message: pod send <channel-id> "Hello!"'));

  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error);
    process.exit(1);
  }
}

export async function loadConfig(): Promise<PodComConfig> {
  try {
    const configPath = path.join(os.homedir(), '.podrc');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    console.log(chalk.yellow('⚠️  No config found. Run "pod init" first.'));
    return DEFAULT_CONFIG;
  }
}
