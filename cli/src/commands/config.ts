import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { table } from "table";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { Keypair } from "@solana/web3.js";
import qrcode from "qrcode-terminal";
import { loadConfig as loadSharedConfig } from "../utils/config.js";

interface CliConfig {
  network: string;
  keypairPath: string;
  programId?: string;
  customEndpoint?: string;
}

export class ConfigCommands {
  private getConfigPath(): string {
    return join(homedir(), ".config", "pod-com", "config.json");
  }

  private loadConfig(): CliConfig {
    return loadSharedConfig();
  }

  private saveConfig(config: CliConfig): void {
    const configPath = this.getConfigPath();
    const configDir = dirname(configPath);

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  private async tryMultipleAirdropSources(publicKey: string, amount: number, spinner: any): Promise<{success: boolean, signature?: string, source?: string}> {
    const lamports = amount * 1000000000; // Convert SOL to lamports
    
    // Primary RPC endpoints to try
    const rpcEndpoints = [
      { name: "Official Devnet", url: "https://api.devnet.solana.com" },
      { name: "Solana Labs RPC", url: "https://devnet.solana.com" },
      { name: "GenesysGo RPC", url: "https://solana-devnet.g.alchemy.com/v2/demo" },
      { name: "QuickNode Public", url: "https://greatest-fittest-tent.solana-devnet.quiknode.pro/0e9f2c7e-de71-4f35-b449-8b37aac10c1b/" },
    ];
    
    // Try RPC endpoints first
    for (const endpoint of rpcEndpoints) {
      spinner.text = `Trying ${endpoint.name}...`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "User-Agent": "PoD-Protocol-CLI/1.4.0"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 1000000),
            method: "requestAirdrop",
            params: [publicKey, lamports],
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          continue;
        }

        const data = await response.json();

        if (data.result) {
          return {
            success: true,
            signature: data.result,
            source: endpoint.name,
          };
        } else if (data.error) {
          if (data.error.code === 429) {
            continue; // Rate limited, try next
          }
          if (data.error.message?.includes("rate")) {
            continue; // Rate limited, try next  
          }
        }
      } catch (error) {
        // Network error or timeout, try next endpoint
        continue;
      }
    }
    
    // Try web-based faucet APIs as backup
    const webFaucets = [
      {
        name: "SOL-Utils Faucet",
        tryAirdrop: () => this.tryWebFaucet(publicKey, amount, "https://sol-utils.com/api/faucet")
      },
      {
        name: "Community Faucet",  
        tryAirdrop: () => this.tryWebFaucet(publicKey, amount, "https://faucet.solana.com/api/airdrop")
      }
    ];
    
    for (const faucet of webFaucets) {
      spinner.text = `Trying ${faucet.name}...`;
      try {
        const result = await faucet.tryAirdrop();
        if (result.success) {
          return {
            success: true,
            signature: result.signature,
            source: faucet.name,
          };
        }
      } catch (error) {
        continue;
      }
    }

    return { success: false };
  }

  private async tryWebFaucet(publicKey: string, amount: number, endpoint: string): Promise<{success: boolean, signature?: string}> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PoD-Protocol-CLI/1.4.0",
        },
        body: JSON.stringify({
          address: publicKey,
          amount: amount,
          network: "devnet",
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.signature || data.txId || data.transaction) {
          return {
            success: true,
            signature: data.signature || data.txId || data.transaction,
          };
        }
      }
    } catch (error) {
      // Fail silently and let caller try next option
    }
    
    return { success: false };
  }

  private showAlternativeFaucetOptions(publicKey: string): void {
    console.log(chalk.yellow("\n🚰 Alternative Devnet SOL Faucet Options:"));
    console.log();
    
    const faucets = [
      {
        name: "Official Solana Faucet",
        url: "https://faucet.solana.com/",
        description: "Web interface, up to 5 SOL every 2 hours",
        icon: "🔹"
      },
      {
        name: "QuickNode Multi-chain Faucet", 
        url: "https://faucet.quicknode.com/solana/devnet",
        description: "0.1 SOL every 24 hours",
        icon: "🔸"
      },
      {
        name: "SOL-Utils Faucet",
        url: "https://sol-utils.com/faucet",
        description: "Instant SOL, SPL tokens, and NFTs",
        icon: "🔶"
      },
      {
        name: "Stakely Faucet",
        url: "https://stakely.io/en/faucet/solana-sol",
        description: "1 SOL every 24 hours",
        icon: "🔷"
      }
    ];

    faucets.forEach((faucet, index) => {
      console.log(`${faucet.icon} ${chalk.cyan.bold(`${index + 1}. ${faucet.name}`)}`);
      console.log(`   ${chalk.white("URL:")} ${chalk.blue(faucet.url)}`);
      console.log(`   ${chalk.gray(faucet.description)}`);
      console.log();
    });

    console.log(chalk.magenta.bold("💡 Pro Tips:"));
    console.log(chalk.gray("   • Try different faucets if one is rate-limited"));
    console.log(chalk.gray("   • Some faucets offer more SOL for GitHub authentication"));
    console.log(chalk.gray("   • Rate limits reset at different times for each service"));
    console.log(chalk.gray("   • Use VPN to change IP if all services are rate-limited"));
    console.log();
    
    console.log(chalk.cyan.bold("📋 Your Wallet Address:"));
    console.log(chalk.white(`   ${publicKey}`));
    console.log();
    
    // Show QR code for easy copying
    console.log(chalk.blue("📱 QR Code for easy mobile access:"));
    qrcode.generate(publicKey, { small: true });
    
    console.log(chalk.green.bold("🔄 Retry Command:"));
    console.log(chalk.white(`   pod config airdrop --amount 2`));
  }

  register(program: Command) {
    const config = program
      .command("config")
      .description("Manage CLI configuration");

    // Show current config
    config
      .command("show")
      .description("Show current configuration")
      .action(async () => {
        try {
          const currentConfig = this.loadConfig();

          const data = [
            ["Network", currentConfig.network],
            ["Keypair Path", currentConfig.keypairPath],
            ["Program ID", currentConfig.programId || "Default"],
            ["Custom Endpoint", currentConfig.customEndpoint || "None"],
            ["Server", currentConfig.serverUrl || "None"],
          ];

          // Check if keypair exists and show public key
          if (existsSync(currentConfig.keypairPath)) {
            try {
              const keypairData = JSON.parse(
                readFileSync(currentConfig.keypairPath, "utf8"),
              );
              const keypair = Keypair.fromSecretKey(
                new Uint8Array(keypairData),
              );
              data.push(["Public Key", keypair.publicKey.toBase58()]);
            } catch {
              data.push(["Public Key", chalk.red("Invalid keypair file")]);
            }
          } else {
            data.push(["Public Key", chalk.red("Keypair file not found")]);
          }

          console.log(
            "\n" +
              table(data, {
                header: {
                  alignment: "center",
                  content: chalk.blue.bold("POD-COM CLI Configuration"),
                },
              }),
          );
        } catch (error: any) {
          console.error(chalk.red("Failed to show config:"), error.message);
          process.exit(1);
        }
      });

    // Set network
    config
      .command("set-network <network>")
      .description("Set the Solana network")
      .action(async (network) => {
        try {
          const validNetworks = ["devnet", "testnet", "mainnet"];
          if (!validNetworks.includes(network)) {
            console.error(
              chalk.red("Error: Invalid network. Must be one of:"),
              validNetworks.join(", "),
            );
            process.exit(1);
          }

          const currentConfig = this.loadConfig();
          currentConfig.network = network;
          this.saveConfig(currentConfig);

          console.log(
            chalk.green("✅ Network updated to:"),
            chalk.cyan(network),
          );
        } catch (error: any) {
          console.error(chalk.red("Failed to set network:"), error.message);
          process.exit(1);
        }
      });

    // Set keypair path
    config
      .command("set-keypair <path>")
      .description("Set the keypair file path")
      .action(async (path) => {
        try {
          // Expand ~ to home directory
          const expandedPath = path.startsWith("~")
            ? join(homedir(), path.slice(1))
            : path;

          if (!existsSync(expandedPath)) {
            console.error(
              chalk.red("Error: Keypair file does not exist:"),
              expandedPath,
            );
            process.exit(1);
          }

          // Validate keypair file
          try {
            const keypairData = JSON.parse(readFileSync(expandedPath, "utf8"));
            const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

            const currentConfig = this.loadConfig();
            currentConfig.keypairPath = expandedPath;
            this.saveConfig(currentConfig);

            console.log(
              chalk.green("✅ Keypair path updated to:"),
              chalk.cyan(expandedPath),
            );
            console.log(
              chalk.cyan("Public key:"),
              keypair.publicKey.toBase58(),
            );
          } catch {
            console.error(chalk.red("Error: Invalid keypair file format"));
            process.exit(1);
          }
        } catch (error: any) {
          console.error(chalk.red("Failed to set keypair:"), error.message);
          process.exit(1);
        }
      });

    // Generate new keypair
    config
      .command("generate-keypair")
      .description("Generate a new keypair")
      .option("-o, --output <path>", "Output file path")
      .option("-f, --force", "Overwrite existing file")
      .action(async (options) => {
        try {
          let outputPath = options.output;

          if (!outputPath) {
            const answers = await inquirer.prompt([
              {
                type: "input",
                name: "outputPath",
                message: "Output file path:",
                default: join(homedir(), ".config", "solana", "id.json"),
              },
            ]);
            outputPath = answers.outputPath;
          }

          // Expand ~ to home directory
          const expandedPath = outputPath.startsWith("~")
            ? join(homedir(), outputPath.slice(1))
            : outputPath;

          if (existsSync(expandedPath) && !options.force) {
            const answers = await inquirer.prompt([
              {
                type: "confirm",
                name: "overwrite",
                message: "File already exists. Overwrite?",
                default: false,
              },
            ]);

            if (!answers.overwrite) {
              console.log(chalk.yellow("Operation cancelled"));
              return;
            }
          }

          const spinner = ora("Generating keypair...").start();

          // Generate new keypair
          const keypair = Keypair.generate();

          // Ensure directory exists
          const outputDir = dirname(expandedPath);
          if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
          }

          // Save keypair
          writeFileSync(
            expandedPath,
            JSON.stringify(Array.from(keypair.secretKey)),
          );

          spinner.succeed("Keypair generated successfully!");

          console.log(chalk.cyan("File:"), expandedPath);
          console.log(chalk.cyan("Public Key:"), keypair.publicKey.toBase58());

          // Show QR code for easy mobile access
          console.log(chalk.blue("\nPublic Key QR Code:"));
          qrcode.generate(keypair.publicKey.toBase58(), { small: true });

          // Update config to use new keypair
          const currentConfig = this.loadConfig();
          currentConfig.keypairPath = expandedPath;
          this.saveConfig(currentConfig);

          console.log(
            chalk.green("\n✅ Configuration updated to use new keypair"),
          );
        } catch (error: any) {
          console.error(
            chalk.red("Failed to generate keypair:"),
            error.message,
          );
          process.exit(1);
        }
      });

    // Airdrop command
    config
      .command("airdrop")
      .description("Request devnet SOL airdrop for development")
      .option(
        "-a, --amount <sol>",
        "Amount of SOL to request (default: 2)",
        "2",
      )
      .action(async (options) => {
        try {
          const currentConfig = this.loadConfig();

          if (currentConfig.network !== "devnet") {
            console.error(
              chalk.red("Error: Airdrop is only available on devnet"),
            );
            console.log(
              chalk.yellow(
                "Tip: Switch to devnet with 'pod config set-network devnet'",
              ),
            );
            return;
          }

          if (!existsSync(currentConfig.keypairPath)) {
            console.error(
              chalk.red("Error: Keypair file not found:"),
              currentConfig.keypairPath,
            );
            console.log(
              chalk.yellow(
                "Tip: Generate a new keypair with 'pod config generate-keypair'",
              ),
            );
            return;
          }

          const amount = parseFloat(options.amount);
          if (amount <= 0 || amount > 5) {
            console.error(
              chalk.red("Error: Amount must be between 0.1 and 5 SOL"),
            );
            return;
          }

          // Load keypair to get public key
          const keypairData = JSON.parse(
            readFileSync(currentConfig.keypairPath, "utf8"),
          );
          const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
          const publicKey = keypair.publicKey.toBase58();

          console.log(chalk.blue("Requesting airdrop..."));
          console.log(chalk.cyan("Wallet:"), publicKey);
          console.log(chalk.cyan("Amount:"), `${amount} SOL`);
          console.log(chalk.cyan("Network:"), "devnet");

          const spinner = ora("Requesting airdrop...").start();

          try {
            // Enhanced multi-endpoint airdrop with comprehensive fallbacks
            const success = await this.tryMultipleAirdropSources(publicKey, amount, spinner);
            
            if (success.success) {
              spinner.succeed("Airdrop successful!");
              console.log(chalk.green("Transaction signature:"), success.signature);
              console.log(chalk.green("Source:"), success.source);
              console.log(
                chalk.cyan(
                  "Tip: It may take 15-30 seconds for the balance to appear",
                ),
              );
            } else {
              spinner.fail("All automated airdrop sources are currently rate-limited");
              this.showAlternativeFaucetOptions(publicKey);
            }
          } catch (error: any) {
            spinner.fail("Airdrop failed");
            console.error(chalk.red("Error:"), error.message);
            console.log(
              chalk.yellow("\nAlternative: Visit https://faucet.solana.com/"),
            );
            console.log(chalk.cyan("Your wallet address:"), publicKey);
          }
        } catch (error: any) {
          console.error(chalk.red("Failed to request airdrop:"), error.message);
          process.exit(1);
        }
      });

    // Set custom RPC endpoint
    config
      .command("set-endpoint <url>")
      .description("Set custom RPC endpoint")
      .action(async (url) => {
        try {
          // Basic URL validation
          try {
            new URL(url);
          } catch {
            console.error(chalk.red("Error: Invalid URL format"));
            process.exit(1);
          }

          const currentConfig = this.loadConfig();
          currentConfig.customEndpoint = url;
          this.saveConfig(currentConfig);

          console.log(
            chalk.green("✅ Custom endpoint set to:"),
            chalk.cyan(url),
          );
        } catch (error: any) {
          console.error(chalk.red("Failed to set endpoint:"), error.message);
          process.exit(1);
        }
      });

    // Set off-chain server URL
    config
      .command("set-server <url>")
      .description("Set off-chain server URL")
      .action(async (url) => {
        try {
          try {
            new URL(url);
          } catch {
            console.error(chalk.red("Error: Invalid URL format"));
            process.exit(1);
          }

          const currentConfig = this.loadConfig();
          currentConfig.serverUrl = url;
          this.saveConfig(currentConfig);

          console.log(chalk.green("✅ Server URL set to:"), chalk.cyan(url));
        } catch (error: any) {
          console.error(chalk.red("Failed to set server:"), error.message);
          process.exit(1);
        }
      });

    // Clear custom endpoint
    config
      .command("clear-endpoint")
      .description("Clear custom RPC endpoint (use default)")
      .action(async () => {
        try {
          const currentConfig = this.loadConfig();
          delete currentConfig.customEndpoint;
          this.saveConfig(currentConfig);

          console.log(chalk.green("✅ Custom endpoint cleared, using default"));
        } catch (error: any) {
          console.error(chalk.red("Failed to clear endpoint:"), error.message);
          process.exit(1);
        }
      });

    // Clear server URL
    config
      .command("clear-server")
      .description("Clear off-chain server URL")
      .action(async () => {
        try {
          const currentConfig = this.loadConfig();
          delete currentConfig.serverUrl;
          this.saveConfig(currentConfig);

          console.log(chalk.green("✅ Server URL cleared"));
        } catch (error: any) {
          console.error(chalk.red("Failed to clear server:"), error.message);
          process.exit(1);
        }
      });

    // Reset config to defaults
    config
      .command("reset")
      .description("Reset configuration to defaults")
      .option("-f, --force", "Skip confirmation")
      .action(async (options) => {
        try {
          if (!options.force) {
            const answers = await inquirer.prompt([
              {
                type: "confirm",
                name: "reset",
                message:
                  "Are you sure you want to reset configuration to defaults?",
                default: false,
              },
            ]);

            if (!answers.reset) {
              console.log(chalk.yellow("Operation cancelled"));
              return;
            }
          }

          const defaultConfig: CliConfig = {
            network: "devnet",
            keypairPath: join(homedir(), ".config", "solana", "id.json"),
          };

          this.saveConfig(defaultConfig);
          console.log(chalk.green("✅ Configuration reset to defaults"));
        } catch (error: any) {
          console.error(chalk.red("Failed to reset config:"), error.message);
          process.exit(1);
        }
      });

    // Interactive setup
    config
      .command("setup")
      .description("Interactive configuration setup")
      .action(async () => {
        try {
          const currentConfig = this.loadConfig();

          console.log(chalk.blue.bold("\n🚀 POD-COM CLI Setup"));
          console.log("Let's configure your POD-COM CLI environment.\n");

          const answers = await inquirer.prompt([
            {
              type: "list",
              name: "network",
              message: "Select Solana network:",
              choices: [
                { name: "Devnet (for development/testing)", value: "devnet" },
                { name: "Testnet (for staging)", value: "testnet" },
                { name: "Mainnet (for production)", value: "mainnet" },
              ],
              default: currentConfig.network,
            },
            {
              type: "confirm",
              name: "generateKeypair",
              message: "Generate a new keypair?",
              default: !existsSync(currentConfig.keypairPath),
            },
            {
              type: "input",
              name: "keypairPath",
              message: "Keypair file path:",
              default: currentConfig.keypairPath,
              when: (answers) => !answers.generateKeypair,
            },
            {
              type: "confirm",
              name: "customEndpoint",
              message: "Use custom RPC endpoint?",
              default: !!currentConfig.customEndpoint,
            },
            {
              type: "input",
              name: "endpointUrl",
              message: "RPC endpoint URL:",
              default: currentConfig.customEndpoint,
              when: (answers) => answers.customEndpoint,
            },
            {
              type: "input",
              name: "serverUrl",
              message: "Off-chain server URL (optional):",
              default: currentConfig.serverUrl,
            },
          ]);

          const spinner = ora("Setting up configuration...").start();

          const newConfig: CliConfig = {
            network: answers.network,
            keypairPath: currentConfig.keypairPath,
          };

          if (answers.generateKeypair) {
            // Generate new keypair
            const keypair = Keypair.generate();
            const keypairPath = join(
              homedir(),
              ".config",
              "pod-com",
              "keypair.json",
            );

            const keypairDir = dirname(keypairPath);
            if (!existsSync(keypairDir)) {
              mkdirSync(keypairDir, { recursive: true });
            }

            writeFileSync(
              keypairPath,
              JSON.stringify(Array.from(keypair.secretKey)),
            );
            newConfig.keypairPath = keypairPath;

            spinner.text = "Generated new keypair...";
          } else {
            newConfig.keypairPath = answers.keypairPath;
          }

          if (answers.customEndpoint) {
            newConfig.customEndpoint = answers.endpointUrl;
          }

          if (answers.serverUrl) {
            newConfig.serverUrl = answers.serverUrl;
          }

          this.saveConfig(newConfig);

          spinner.succeed("Setup completed successfully!");

          console.log(chalk.green("\n✅ POD-COM CLI is now configured!"));
          console.log(chalk.cyan("Network:"), newConfig.network);
          console.log(chalk.cyan("Keypair:"), newConfig.keypairPath);

          if (newConfig.customEndpoint) {
            console.log(chalk.cyan("Endpoint:"), newConfig.customEndpoint);
          }
          if (newConfig.serverUrl) {
            console.log(chalk.cyan("Server:"), newConfig.serverUrl);
          }

          if (answers.generateKeypair) {
            const keypairData = JSON.parse(
              readFileSync(newConfig.keypairPath, "utf8"),
            );
            const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
            console.log(
              chalk.cyan("Public Key:"),
              keypair.publicKey.toBase58(),
            );
          }

          console.log(chalk.blue("\nNext steps:"));
          console.log("• Run 'pod status' to check your connection");
          console.log("• Run 'pod agent register' to register as an AI agent");
          console.log("• Run 'pod --help' to see all available commands");
        } catch (error: any) {
          console.error(chalk.red("Setup failed:"), error.message);
          process.exit(1);
        }
      });

    // Faucet status check command
    config
      .command("faucet-status")
      .description("Check status of available devnet faucets")
      .action(async () => {
        try {
          await this.checkFaucetStatus();
        } catch (error: any) {
          console.error(chalk.red("Failed to check faucet status:"), error.message);
          process.exit(1);
        }
      });

    // Comprehensive faucet help command
    config
      .command("faucet-help")
      .description("Show comprehensive faucet options and troubleshooting")
      .action(async () => {
        try {
          const currentConfig = this.loadConfig();
          
          if (!existsSync(currentConfig.keypairPath)) {
            console.error(
              chalk.red("Error: Keypair file not found:"),
              currentConfig.keypairPath,
            );
            console.log(
              chalk.yellow(
                "Tip: Generate a new keypair with 'pod config generate-keypair'",
              ),
            );
            return;
          }

          const keypairData = JSON.parse(
            readFileSync(currentConfig.keypairPath, "utf8"),
          );
          const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
          const publicKey = keypair.publicKey.toBase58();

          this.showAlternativeFaucetOptions(publicKey);
        } catch (error: any) {
          console.error(chalk.red("Failed to show faucet help:"), error.message);
          process.exit(1);
        }
      });
  }

  private async checkFaucetStatus(): Promise<void> {
    console.log(chalk.blue.bold("🚰 Devnet SOL Faucet Status Check"));
    console.log();

    const faucets = [
      { name: "Official Solana Faucet", url: "https://faucet.solana.com/" },
      { name: "Official Devnet RPC", url: "https://api.devnet.solana.com" },
      { name: "QuickNode Faucet", url: "https://faucet.quicknode.com/" },
      { name: "SOL-Utils Faucet", url: "https://sol-utils.com/" },
    ];

    const spinner = ora("Checking faucet availability...").start();

    for (const faucet of faucets) {
      spinner.text = `Checking ${faucet.name}...`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(faucet.url, {
          method: "HEAD",
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ ${chalk.green(faucet.name)}: ${chalk.cyan("Available")}`);
        } else {
          console.log(`⚠️  ${chalk.yellow(faucet.name)}: ${chalk.red("Unavailable")} (${response.status})`);
        }
      } catch (error) {
        console.log(`❌ ${chalk.red(faucet.name)}: ${chalk.red("Connection failed")}`);
      }
    }

    spinner.stop();
    console.log();
    console.log(chalk.gray("Note: This checks website availability, not API rate limits"));
    console.log(chalk.cyan("Tip: Try 'pod config airdrop' to test actual faucet functionality"));
  }
}
