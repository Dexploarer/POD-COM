import { PublicKey, Signer, GetProgramAccountsFilter, SystemProgram } from "@solana/web3.js";
import anchor from "@coral-xyz/anchor";
import fetch from "cross-fetch";
import { BaseService } from "./base";
import {
  MessageAccount,
  SendMessageOptions,
  MessageType,
  MessageStatus,
} from "../types";
import { 
  findAgentPDA,
  findMessagePDA, 
  hashPayload, 
  retry,
  convertMessageTypeToProgram,
  convertMessageTypeFromProgram,
  getAccountTimestamp,
  getAccountCreatedAt,
} from "../utils";

/**
 * Message-related operations service
 */
export class MessageService extends BaseService {
  async sendMessage(wallet: Signer, options: SendMessageOptions): Promise<string> {
    const program = this.ensureInitialized();

    // Derive sender agent PDA
    const [senderAgentPDA] = findAgentPDA(wallet.publicKey, this.programId);

    // Hash the payload
    const payloadHash = await hashPayload(options.payload);

    // Convert message type
    const messageTypeObj = this.convertMessageType(options.messageType, options.customValue);

    // Find message PDA
    const [messagePDA] = findMessagePDA(
      senderAgentPDA,
      options.recipient,
      payloadHash,
      messageTypeObj,
      this.programId
    );

    const tx = await retry(async () => {
      const sig = await program.methods
        .sendMessage(
          options.recipient,
          Array.from(payloadHash),
          messageTypeObj
        )
        .accounts({
          messageAccount: messagePDA,
          senderAgent: senderAgentPDA,
          signer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc({ commitment: this.commitment });

      return sig;
    });

    if (this.serverUrl) {
      try {
        await fetch(`${this.serverUrl}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: wallet.publicKey.toBase58(),
            recipient: options.recipient.toBase58(),
            payload: typeof options.payload === "string"
              ? options.payload
              : Buffer.from(options.payload).toString("base64"),
          }),
        });
      } catch (err) {
        console.warn("Failed to send payload to server", err);
      }
    }

    return tx;
  }

  async updateMessageStatus(
    wallet: Signer,
    messagePDA: PublicKey,
    newStatus: MessageStatus,
  ): Promise<string> {
    return retry(async () => {
      const methods = this.getProgramMethods();
      const tx = await methods
        .updateMessageStatus(this.convertMessageStatus(newStatus))
        .accounts({
          messageAccount: messagePDA,
          authority: wallet.publicKey,
        })
        .signers([wallet])
        .rpc({ commitment: this.commitment });

      return tx;
    });
  }

  async getMessage(messagePDA: PublicKey): Promise<MessageAccount | null> {
    try {
      const account = await this.getAccount("messageAccount").fetch(messagePDA);
      return this.convertMessageAccountFromProgram(account, messagePDA);
    } catch (error: any) {
      if (error?.message?.includes("Account does not exist")) {
        return null;
      }
      throw error;
    }
  }

  async getAgentMessages(
    agentPublicKey: PublicKey,
    limit: number = 50,
    statusFilter?: MessageStatus,
  ): Promise<MessageAccount[]> {
    try {
      const filters: GetProgramAccountsFilter[] = [
        {
          memcmp: {
            offset: 8 + 32,
            bytes: agentPublicKey.toBase58(),
          },
        },
      ];

      if (statusFilter !== undefined) {
        const statusBytes = this.convertMessageStatus(statusFilter);
        filters.push({
          memcmp: {
            offset: 8 + 32 + 32 + 4 + 200,
            bytes: statusBytes,
          },
        });
      }

      const accounts = await this.connection.getProgramAccounts(
        this.programId,
        {
          filters,
          commitment: this.commitment,
        },
      );

      return accounts.slice(0, limit).map((acc) => {
        const account = this.ensureInitialized().coder.accounts.decode(
          "messageAccount",
          acc.account.data,
        );
        return this.convertMessageAccountFromProgram(account, acc.pubkey);
      });
    } catch (error: any) {
      throw new Error(`Failed to fetch agent messages: ${error.message}`);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private convertMessageType(messageType: MessageType, customValue?: number): any {
    return convertMessageTypeToProgram(messageType, customValue);
  }

  private convertMessageTypeFromProgram(programType: any): MessageType {
    const result = convertMessageTypeFromProgram(programType);
    return result.type;
  }

  private convertMessageStatus(status: MessageStatus): any {
    switch (status) {
      case MessageStatus.Pending:
        return { pending: {} };
      case MessageStatus.Delivered:
        return { delivered: {} };
      case MessageStatus.Read:
        return { read: {} };
      case MessageStatus.Failed:
        return { failed: {} };
      default:
        throw new Error(`Unknown message status: ${status}`);
    }
  }

  private convertMessageStatusFromProgram(programStatus: any): MessageStatus {
    if (programStatus.pending) return MessageStatus.Pending;
    if (programStatus.delivered) return MessageStatus.Delivered;
    if (programStatus.read) return MessageStatus.Read;
    if (programStatus.failed) return MessageStatus.Failed;
    throw new Error(`Unknown program status: ${JSON.stringify(programStatus)}`);
  }

  private convertMessageAccountFromProgram(
    account: any,
    publicKey: PublicKey,
  ): MessageAccount {
    return {
      pubkey: publicKey,
      sender: new PublicKey(account.sender),
      recipient: new PublicKey(account.recipient),
      payload: account.payload || account.content || "",
      payloadHash: account.payloadHash,
      messageType: this.convertMessageTypeFromProgram(account.messageType),
      status: this.convertMessageStatusFromProgram(account.status),
      timestamp: getAccountTimestamp(account),
      createdAt: getAccountCreatedAt(account),
      expiresAt: account.expiresAt?.toNumber() || 0,
      bump: account.bump,
    };
  }
}
