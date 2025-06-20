import { Command } from "commander";
import inquirer from "inquirer";
import { table } from "table";
import { PublicKey, Signer } from "@solana/web3.js";
import { PodComClient, lamportsToSol, solToLamports } from "@pod-protocol/sdk";
import {
  createCommandHandler,
  handleDryRun,
  createSpinner,
  showSuccess,
  getTableConfig,
  formatValue,
  GlobalOptions,
} from "../utils/shared.js";
import {
  validatePublicKey,
  validateSolAmount,
  validatePositiveInteger,
  ValidationError,
} from "../utils/validation.js";

// Helper for interactive channel/amount prompts
async function promptChannelAndAmount({
  interactive,
  channel,
  amount,
  lamports,
  all,
  withdraw = false,
}) {
  let channelId = channel;
  let amt = 0;
  let withdrawAll = all;

  if (interactive) {
    const questions: Array<Record<string, any>> = [
      {
        type: "input",
        name: "channelId",
        message: "Channel ID:",
        validate: (input: string) => {
          try {
            new PublicKey(input);
            return true;
          } catch {
            return "Please enter a valid channel ID";
          }
        },
      },
    ];
    if (withdraw) {
      questions.push({
        type: "confirm",
        name: "withdrawAll",
        message: "Withdraw all available funds?",
        default: false,
      });
    }
    questions.push({
      type: "list",
      name: "unit",
      message: "Amount unit:",
      choices: [
        { name: "SOL", value: "sol" },
        { name: "Lamports", value: "lamports" },
      ],
      when: (answers: Record<string, any>) => !withdraw || !answers.withdrawAll,
    });
    questions.push({
      type: "number",
      name: "amount",
      message: "Amount:",
      validate: (input: number) => (input > 0 ? true : "Amount must be greater than 0"),
      when: (answers: Record<string, any>) => !withdraw || !answers.withdrawAll,
    });
    const answers = await inquirer.prompt(questions as any);
    channelId = answers.channelId;
    withdrawAll = withdraw ? answers.withdrawAll : false;
    amt =
      withdraw && answers.withdrawAll
        ? 0
        : answers.unit === "sol"
          ? solToLamports(answers.amount)
          : answers.amount;
  } else {
    if (!channelId) {
      throw new ValidationError("Channel ID is required");
    }
    if (withdraw && !withdrawAll) {
      validateAmountOptions(amount, lamports, withdraw);
      amt = getAmountFromOptions(amount, lamports);
    } else if (!withdraw) {
      validateAmountOptions(amount, lamports, withdraw);
      amt = getAmountFromOptions(amount, lamports);
    }
  }
  return { channelId, amount: amt, withdrawAll };
}

function validateAmountOptions(amount, lamports, withdraw = false) {
  if (amount && lamports) {
    throw new ValidationError(
      "Specify either --amount (SOL) or --lamports, not both",
    );
  }
  if (!withdraw && !amount && !lamports) {
    throw new ValidationError(
      "Amount is required (use --amount for SOL or --lamports)",
    );
  }
  if (withdraw && !amount && !lamports) {
    throw new ValidationError(
      "Amount is required (use --amount for SOL, --lamports, or --all)",
    );
  }
}

function getAmountFromOptions(amount, lamports) {
  if (amount) {
    const solAmount = validateSolAmount(amount, "SOL amount");
    return solToLamports(solAmount);
  } else if (lamports) {
    return validatePositiveInteger(lamports, "lamports amount");
  }
  return 0;
}

export class EscrowCommands {
  register(program: Command) {
    const escrow = program
      .command("escrow")
      .description("Manage escrow accounts for channel fees");

    // Deposit to escrow
    escrow
      .command("deposit")
      .description("Deposit SOL to channel escrow for fees")
      .option("-c, --channel <channelId>", "Channel ID")
      .option("-a, --amount <sol>", "Amount in SOL to deposit")
      .option("-l, --lamports <lamports>", "Amount in lamports to deposit")
      .option("-i, --interactive", "Interactive deposit")
      .action(
        createCommandHandler(
          "deposit to escrow",
          async (client, wallet, globalOpts, options) => {
            await this.handleDeposit(client, wallet, globalOpts, options);
          },
        ),
      );

    // Withdraw from escrow
    escrow
      .command("withdraw")
      .description("Withdraw SOL from channel escrow")
      .option("-c, --channel <channelId>", "Channel ID")
      .option("-a, --amount <sol>", "Amount in SOL to withdraw")
      .option("-l, --lamports <lamports>", "Amount in lamports to withdraw")
      .option("--all", "Withdraw all available funds")
      .option("-i, --interactive", "Interactive withdrawal")
      .action(
        createCommandHandler(
          "withdraw from escrow",
          async (client, wallet, globalOpts, options) => {
            await this.handleWithdraw(client, wallet, globalOpts, options);
          },
        ),
      );

    // Show escrow balance
    escrow
      .command("balance")
      .description("Show escrow balance for a channel")
      .option("-c, --channel <channelId>", "Channel ID")
      .option(
        "-a, --agent [address]",
        "Agent address (defaults to current wallet)",
      )
      .action(
        createCommandHandler(
          "fetch escrow balance",
          async (client, wallet, globalOpts, options) => {
            await this.handleBalance(client, wallet, options);
          },
        ),
      );

    // List all escrow accounts
    escrow
      .command("list")
      .description("List all escrow accounts for current wallet")
      .option("-l, --limit <number>", "Maximum number of escrows to show", "10")
      .action(
        createCommandHandler(
          "list escrow accounts",
          async (client, wallet, globalOpts, options) => {
            await this.handleList(client, wallet, options);
          },
        ),
      );
  }

  private async handleDeposit(
    client: PodComClient,
    wallet: Signer,
    globalOpts: GlobalOptions,
    options: Record<string, any>
  ) {
    const { channelId, amount } = await promptChannelAndAmount({
      interactive: options.interactive,
      channel: options.channel,
      amount: options.amount,
      lamports: options.lamports,
      all: options.all,
    });
    const spinner = createSpinner("Depositing to escrow...");
    if (
      globalOpts.dryRun &&
      handleDryRun(globalOpts, spinner, "Escrow deposit", {
        Channel: channelId,
        Amount: `${lamportsToSol(amount)} SOL (${amount} lamports)`,
      })
    ) {
      return;
    }
    const channelKey = validatePublicKey(channelId, "channel ID");
    if (
      handleDryRun(globalOpts, spinner, "Escrow deposit", {
        Channel: channelId,
        Amount: `${lamportsToSol(amount)} SOL (${amount} lamports)`,
      })
    ) {
      return;
    }
    const signature = await client.depositEscrow(wallet, {
      channel: channelKey,
      amount,
    });
    showSuccess(spinner, "Escrow deposit successful!", {
      Transaction: signature,
      Channel: channelId,
      Deposited: `${lamportsToSol(amount)} SOL`,
    });
  }

  private async handleWithdraw(
    client: PodComClient,
    wallet: Signer,
    globalOpts: GlobalOptions,
    options: Record<string, any>
  ) {
    const {
      channelId,
      amount: promptAmount,
      withdrawAll,
    } = await promptChannelAndAmount({
      interactive: options.interactive,
      channel: options.channel,
      amount: options.amount,
      lamports: options.lamports,
      all: options.all,
      withdraw: true,
    });
    const channelKey = validatePublicKey(channelId, "channel ID");
    const spinner = createSpinner("Withdrawing from escrow...");
    // If withdrawing all, get current balance first
    let amount = promptAmount;
    if (withdrawAll) {
      const escrowData = await client.getEscrow(channelKey, wallet.publicKey);
      if (!escrowData) {
        spinner.fail("No escrow account found for this channel");
        return;
      }
      amount = escrowData.balance;
    }
    if (
      handleDryRun(globalOpts, spinner, "Escrow withdrawal", {
        Channel: channelId,
        Amount: withdrawAll
          ? "All funds"
          : `${lamportsToSol(amount)} SOL (${amount} lamports)`,
      })
    ) {
      return;
    }
    const signature = await client.withdrawEscrow(wallet, {
      channel: channelKey,
      amount,
    });
    showSuccess(spinner, "Escrow withdrawal successful!", {
      Transaction: signature,
      Channel: channelId,
      Withdrawn: `${lamportsToSol(amount)} SOL`,
    });
  }

  private async handleBalance(client: PodComClient, wallet: Signer, options: Record<string, any>) {
    if (!options.channel) {
      throw new ValidationError("Channel ID is required");
    }

    const channelKey = validatePublicKey(options.channel, "channel ID");
    const spinner = createSpinner("Fetching escrow balance...");

    let agentAddress;
    if (options.agent) {
      agentAddress = validatePublicKey(options.agent, "agent address");
    } else {
      agentAddress = wallet.publicKey;
    }

    const escrowData = await client.getEscrow(channelKey, agentAddress);

    if (!escrowData) {
      spinner.succeed("No escrow account found");
      return;
    }

    spinner.succeed("Escrow balance retrieved");

    const data = [
      ["Channel", formatValue(escrowData.channel.toBase58(), "address")],
      ["Depositor", formatValue(escrowData.depositor.toBase58(), "address")],
      [
        "Balance",
        formatValue(`${lamportsToSol(escrowData.balance)} SOL`, "number"),
      ],
      [
        "Balance (Lamports)",
        formatValue(escrowData.balance.toString(), "number"),
      ],
      [
        "Last Updated",
        formatValue(
          new Date(escrowData.lastUpdated * 1000).toLocaleString(),
          "text",
        ),
      ],
    ];

    console.log("\n" + table(data, getTableConfig("Escrow Balance")));
  }

  private async handleList(client: PodComClient, wallet: Signer, options: Record<string, any>) {
    const limit = validatePositiveInteger(options.limit, "limit");
    const spinner = createSpinner("Fetching escrow accounts...");

    const escrows = await client.getEscrowsByDepositor(wallet.publicKey, limit);

    if (escrows.length === 0) {
      spinner.succeed("No escrow accounts found");
      return;
    }

    spinner.succeed(`Found ${escrows.length} escrow accounts`);

    const data = escrows.map((escrow: Record<string, any>) => [
      formatValue(escrow.channel.toBase58().slice(0, 8) + "...", "address"),
      formatValue(`${lamportsToSol(escrow.balance)} SOL`, "number"),
      formatValue(escrow.balance.toString(), "number"),
      formatValue(
        new Date(escrow.lastUpdated * 1000).toLocaleDateString(),
        "text",
      ),
    ]);

    console.log(
      "\n" +
        table(
          [
            ["Channel", "Balance (SOL)", "Balance (Lamports)", "Last Updated"],
            ...data,
          ],
          getTableConfig("Escrow Accounts"),
        ),
    );
  }
}
