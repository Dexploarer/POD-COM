import chalk from "chalk";
import ora, { Ora } from "ora";
import { PodComClient } from "@pod-protocol/sdk";
import { createClient, getWallet, getKeypair } from "./client.js";
import { Command } from "commander";
import { safeExecute } from "./error-handler.js";

export interface GlobalOptions {
  network?: string;
  keypair?: string;
  dryRun?: boolean;
}

/**
 * Common error handler for CLI commands
 */
export function handleCommandError(error: any, action: string): never {
  console.error(chalk.red(`Failed to ${action}:`), error.message);
  process.exit(1);
}

/**
 * Create wrapped command handler with common error handling
 */
export function createCommandHandler<T extends any[]>(
  action: string,
  handler: (
    client: PodComClient,
    wallet: any,
    globalOpts: GlobalOptions,
    ...args: T
  ) => Promise<void>,
) {
  return async (...args: any[]) => {
    try {
      // Commander.js passes the command object as the last argument
      const cmd = args[args.length - 1];
      const globalOpts = getCommandOpts(cmd);
      const commandArgs = args.slice(0, -1) as T;
      
      let wallet: ReturnType<typeof getWallet> | undefined;
      let keypair: ReturnType<typeof getKeypair> | undefined;

      if (!globalOpts.dryRun) {
        wallet = getWallet(globalOpts.keypair);
        keypair = getKeypair(globalOpts.keypair);
      }

      const client = await createClient(globalOpts.network, wallet);
      await handler(client, keypair, globalOpts, ...commandArgs);
    } catch (error: any) {
      handleCommandError(error, action);
    }
  };
}

/**
 * Handle dry run logic with spinner
 */
export function handleDryRun(
  globalOpts: GlobalOptions,
  spinner: Ora,
  action: string,
  details?: Record<string, any>,
): boolean {
  if (globalOpts.dryRun) {
    spinner.succeed(`Dry run: ${action} prepared`);
    if (details) {
      Object.entries(details).forEach(([key, value]) => {
        console.log(chalk.cyan(`${key}:`), value);
      });
    }
    return true;
  }
  return false;
}

/**
 * Create spinner with consistent messaging
 */
export function createSpinner(message: string): Ora {
  return ora({ text: message, stream: process.stdout }).start();
}

/**
 * Success message with spinner
 */
export function showSuccess(
  spinner: Ora,
  message: string,
  details?: Record<string, any>,
): void {
  spinner.succeed(message);
  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      console.log(chalk.green(`${key}:`), value);
    });
  }
}

/**
 * Common table configuration
 */
export const getTableConfig = (title: string) => ({
  header: {
    alignment: "center" as const,
    content: chalk.blue.bold(title),
  },
});

/**
 * Format value for display with appropriate styling
 */
export function formatValue(
  value: any,
  type: "address" | "number" | "text" | "boolean" = "text",
): string {
  if (value === null || value === undefined) {
    return chalk.gray("N/A");
  }

  switch (type) {
    case "address":
      return chalk.yellow(value.toString());
    case "number":
      return chalk.cyan(value.toString());
    case "boolean":
      return value ? chalk.green("✓") : chalk.red("✗");
    default:
      return value.toString();
  }
}

/**
 * Common validation for public key addresses
 */
export function validatePublicKey(address: string, fieldName: string): void {
  try {
    new (require("@solana/web3.js").PublicKey)(address);
  } catch {
    throw new Error(`Invalid ${fieldName}: ${address}`);
  }
}

/**
 * Get command options in a compatible way across Commander.js versions
 */
export function getCommandOpts(cmd: Command): GlobalOptions {
  // Try optsWithGlobals first (v8+)
  if (typeof (cmd as any).optsWithGlobals === "function") {
    return (cmd as any).optsWithGlobals();
  }
  // Fallback to parent opts (older versions)
  return cmd.parent?.opts() || {};
}

/**
 * Enhanced command handler with centralized error handling
 */
export function createSafeCommandHandler(
  description: string,
  handler: (
    client: PodComClient,
    wallet: any,
    globalOpts: GlobalOptions,
    ...args: any[]
  ) => Promise<void>,
) {
  return async (...args: any[]) => {
    const cmd = args[args.length - 1];
    const globalOpts = getCommandOpts(cmd);

    await safeExecute(async () => {
      const client = await createClient(globalOpts.network);
      const wallet = getWallet(globalOpts.keypair);
      await handler(client, wallet, globalOpts, ...args.slice(0, -1));
    }, description);
  };
}
