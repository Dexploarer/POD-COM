import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Keypair } from "@solana/web3.js";
import chalk from "chalk";

interface CliConfig {
  network: string;
  keypairPath: string;
  programId?: string;
  customEndpoint?: string;
  serverUrl?: string;
  serverWsUrl?: string;
}

/**
 * Load CLI configuration from file
 */
export function loadConfig(): CliConfig {
  const configPath = join(homedir(), ".config", "pod-com", "config.json");

  if (!existsSync(configPath)) {
    return {
      network: "devnet",
      keypairPath: join(homedir(), ".config", "solana", "id.json"),
    };
  }

  try {
    const configData = readFileSync(configPath, "utf8");
    return JSON.parse(configData);
  } catch {
    console.warn(
      chalk.yellow("Warning: Could not read config file, using defaults"),
    );
    return {
      network: "devnet",
      keypairPath: join(homedir(), ".config", "solana", "id.json"),
    };
  }
}

/**
 * Load keypair from file path
 */
export function loadKeypair(keypairPath?: string): Keypair {
  const config = loadConfig();
  const path = keypairPath || config.keypairPath;

  // Expand ~ to home directory
  const expandedPath = path.startsWith("~")
    ? join(homedir(), path.slice(1))
    : path;

  if (!existsSync(expandedPath)) {
    console.error(chalk.red("Error: Keypair file not found:"), expandedPath);
    console.log(
      chalk.yellow(
        "Tip: Generate a new keypair with 'pod config generate-keypair'",
      ),
    );
    process.exit(1);
  }

  try {
    const keypairData = JSON.parse(readFileSync(expandedPath, "utf8"));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch {
    console.error(
      chalk.red("Error: Invalid keypair file format:"),
      expandedPath,
    );
    console.log(
      chalk.yellow("Tip: Ensure the file contains a valid Solana keypair"),
    );
    process.exit(1);
  }
}

/**
 * Get network endpoint URL
 */
export function getNetworkEndpoint(network?: string): string {
  const config = loadConfig();
  const selectedNetwork = network || config.network;

  // Use custom endpoint if configured
  if (config.customEndpoint) {
    return config.customEndpoint;
  }

  // Default endpoints for each network
  switch (selectedNetwork) {
    case "devnet":
      return "https://api.devnet.solana.com";
    case "testnet":
      return "https://api.testnet.solana.com";
    case "mainnet":
      return "https://api.mainnet-beta.solana.com";
    default:
      console.error(chalk.red("Error: Invalid network:"), selectedNetwork);
      console.log(chalk.yellow("Valid networks: devnet, testnet, mainnet"));
      process.exit(1);
  }
}

/**
 * Get program ID from config or default
 */
export function getProgramId(): string {
  const config = loadConfig();
  return config.programId || "HEpGLgYsE1kP8aoYKyLFc3JVVrofS7T4zEA6fWBJsZps";
}

/**
 * Validate network name
 */
export function isValidNetwork(network: string): boolean {
  return ["devnet", "testnet", "mainnet"].includes(network);
}

/**
 * Format SOL amount for display
 */
export function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(9) + " SOL";
}

/**
 * Format transaction signature for display
 */
export function formatSignature(signature: string): string {
  return signature.length > 20
    ? signature.slice(0, 8) + "..." + signature.slice(-8)
    : signature;
}

export function getServerUrl(): string | undefined {
  const config = loadConfig();
  return config.serverUrl;
}

export function getServerWsUrl(): string | undefined {
  const config = loadConfig();
  return config.serverWsUrl;
}

/**
 * Validate Solana public key format
 */
export function isValidPublicKey(key: string): boolean {
  try {
    // Base58 check - Solana public keys are 44 characters in base58
    return (
      key.length >= 32 &&
      key.length <= 44 &&
      /^[1-9A-HJ-NP-Za-km-z]+$/.test(key)
    );
  } catch {
    return false;
  }
}
