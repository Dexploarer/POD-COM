import { PublicKey } from "@solana/web3.js";
import { MessageType } from "@pod-protocol/sdk";
import inquirer from "inquirer";
import {
  createSpinner,
  handleDryRun,
  showSuccess,
} from "../../utils/shared.js";
import { getWallet } from "../../utils/client.js";
import { ValidationError } from "../../utils/validation.js";
import { MessageDisplayer } from "./displayer.js";
import { MessageValidators } from "./validators.js";
import {
  CommandContext,
  SendMessageOptions,
  MessageStatusOptions,
  MessageListOptions,
} from "./types.js";

export class MessageHandlers {
  private readonly context: CommandContext;
  private readonly displayer: MessageDisplayer;

  constructor(context: CommandContext) {
    this.context = context;
    this.displayer = new MessageDisplayer();
  }

  public async handleSend(options: SendMessageOptions): Promise<void> {
    let recipient = options.recipient;
    let payload = options.payload;
    let messageType = options.type as MessageType;
    let customValue = options.customValue
      ? parseInt(options.customValue, 10)
      : 0;

    if (options.interactive) {
      const answers = await this.promptForMessageData();
      recipient = answers.recipient;
      payload = answers.payload;
      messageType = answers.messageType;
      customValue = answers.customValue || 0;
    }

    if (!recipient || !payload) {
      throw new ValidationError("Recipient and payload are required");
    }

    const validatedPayload = MessageValidators.validateMessageContent(payload);

    const spinner = createSpinner("Sending message...");

    if (this.context.globalOpts.dryRun) {
      handleDryRun(this.context.globalOpts, spinner, "Message send", {
        Recipient: recipient,
        Type: messageType,
        Content:
          validatedPayload.slice(0, 100) +
          (validatedPayload.length > 100 ? "..." : ""),
        "Custom Value": customValue > 0 ? customValue : "N/A",
      });
      return;
    }

    const recipientKey = MessageValidators.validateRecipient(recipient);

    if (
      handleDryRun(this.context.globalOpts, spinner, "Message send", {
        Recipient: recipientKey.toBase58(),
        Type: messageType,
        Content:
          validatedPayload.slice(0, 100) +
          (validatedPayload.length > 100 ? "..." : ""),
        "Custom Value": customValue > 0 ? customValue : "N/A",
      })
    ) {
      return;
    }

    const signature = await this.context.client.sendMessage(
      this.context.wallet,
      {
        recipient: recipientKey,
        payload: validatedPayload,
        messageType,
        customValue,
      },
    );

    showSuccess(spinner, "Message sent successfully!", {
      Transaction: signature,
      Recipient: recipientKey.toBase58(),
      Type: messageType,
    });
  }

  public async handleInfo(messageId: string): Promise<void> {
    const messageKey = MessageValidators.validateMessageId(messageId);
    const spinner = createSpinner("Fetching message information...");

    const messageData = await this.context.client.getMessage(messageKey);

    if (!messageData) {
      spinner.fail("Message not found");
      return;
    }

    spinner.succeed("Message information retrieved");
    this.displayer.displayMessageInfo(messageData);
  }

  public async handleStatus(options: MessageStatusOptions): Promise<void> {
    if (!options.message || !options.status) {
      throw new ValidationError("Message ID and status are required");
    }

    const messageKey = MessageValidators.validateMessageId(options.message);
    const validatedStatus = MessageValidators.validateMessageStatus(
      options.status,
    );

    const spinner = createSpinner("Updating message status...");

    if (
      handleDryRun(this.context.globalOpts, spinner, "Message status update", {
        Message: options.message,
        "New Status": validatedStatus,
      })
    ) {
      return;
    }

    const signature = await this.context.client.updateMessageStatus(
      this.context.wallet,
      messageKey,
      validatedStatus,
    );

    showSuccess(spinner, "Message status updated successfully!", {
      Transaction: signature,
      Message: options.message,
      "New Status": validatedStatus,
    });
  }

  public async handleList(options: MessageListOptions): Promise<void> {
    const limit = options.limit
      ? MessageValidators.validateLimit(options.limit)
      : 10;
    const spinner = createSpinner("Fetching messages...");

    let agentAddress: PublicKey;
    if (options.agent) {
      agentAddress = MessageValidators.validateAgentAddress(options.agent);
    } else {
      const wallet = getWallet(this.context.globalOpts.keypair);
      agentAddress = wallet.publicKey;
    }

    const messages = await this.context.client.getAgentMessages(
      agentAddress,
      limit,
      options.filter,
    );

    if (messages.length === 0) {
      spinner.succeed("No messages found");
      return;
    }

    spinner.succeed(`Found ${messages.length} messages`);
    this.displayer.displayMessagesList(messages);
  }

  private async promptForMessageData() {
    return await inquirer.prompt([
      {
        type: "input",
        name: "recipient",
        message: "Recipient agent address:",
        validate: MessageValidators.validateRecipientInteractive,
      },
      {
        type: "list",
        name: "messageType",
        message: "Message type:",
        choices: [
          {
            name: "Text - Plain text message",
            value: MessageType.Text,
          },
          {
            name: "Data - Structured data transfer",
            value: MessageType.Data,
          },
          {
            name: "Command - Command/instruction",
            value: MessageType.Command,
          },
          {
            name: "Response - Response to command",
            value: MessageType.Response,
          },
          {
            name: "Custom - Custom message type",
            value: MessageType.Custom,
          },
        ],
      },
      {
        type: "editor",
        name: "payload",
        message: "Message content:",
        default: "",
      },
      {
        type: "number",
        name: "customValue",
        message: "Custom value (for custom message types):",
        default: 0,
        when: (answers) => answers.messageType === MessageType.Custom,
      },
    ]);
  }
}
