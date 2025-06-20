import {
  Connection,
  PublicKey,
  Signer,
  Commitment,
} from "@solana/web3.js";
import anchor, { Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  PROGRAM_ID,
  PodComConfig,
  AgentAccount,
  MessageAccount,
  ChannelAccount,
  EscrowAccount,
  CreateAgentOptions,
  UpdateAgentOptions,
  SendMessageOptions,
  CreateChannelOptions,
  DepositEscrowOptions,
  WithdrawEscrowOptions,
  BroadcastMessageOptions,
  MessageStatus,
  ChannelVisibility,
} from "./types";
import { PodCom, IDL } from "./pod_com";
import type { IdlAccounts } from "@coral-xyz/anchor";

// Import services
import { BaseService, BaseServiceConfig } from "./services/base";
import { AgentService } from "./services/agent";
import { MessageService } from "./services/message";
import { ChannelService } from "./services/channel";
import { EscrowService } from "./services/escrow";
import { AnalyticsService } from "./services/analytics";
import { DiscoveryService } from "./services/discovery";

/**
 * Main PoD Protocol SDK client for interacting with the protocol
 * Refactored to use service-based architecture for better maintainability
 */
export class PodComClient {
  private connection: Connection;
  private programId: PublicKey;
  private commitment: Commitment;
  private program?: Program<PodCom>;

  // Service instances - public for direct access to specific functionality
  public agents: AgentService;
  public messages: MessageService;
  public channels: ChannelService;
  public escrow: EscrowService;
  public analytics: AnalyticsService;
  public discovery: DiscoveryService;
  private serverUrl?: string;

  constructor(config: PodComConfig = {}) {
    this.connection = new Connection(
      config.endpoint ?? "https://api.devnet.solana.com",
      config.commitment ?? "confirmed",
    );
    this.programId = config.programId ?? PROGRAM_ID;
    this.commitment = config.commitment ?? "confirmed";
    this.serverUrl = config.serverUrl;

    // Initialize services
    const serviceConfig: BaseServiceConfig = {
      connection: this.connection,
      programId: this.programId,
      commitment: this.commitment,
      serverUrl: this.serverUrl,
    };

    this.agents = new AgentService(serviceConfig);
    this.messages = new MessageService(serviceConfig);
    this.channels = new ChannelService(serviceConfig);
    this.escrow = new EscrowService(serviceConfig);
    this.analytics = new AnalyticsService(serviceConfig);
    this.discovery = new DiscoveryService(serviceConfig);
  }

  getServerUrl(): string | undefined {
    return this.serverUrl;
  }

  /**
   * Initialize the Anchor program with a wallet (call this first)
   */
  async initialize(wallet?: anchor.Wallet): Promise<void> {
    try {
      if (wallet) {
        // If a wallet is provided, create the program with it
        const provider = new AnchorProvider(this.connection, wallet, {
          commitment: this.commitment,
          skipPreflight: true,
        });

        // Validate IDL before creating program
        if (!IDL) {
          throw new Error(
            "IDL not found. Ensure the program IDL is properly generated and imported.",
          );
        }
        
        this.program = new Program(IDL, provider) as Program<PodCom>;
        
        // Validate program was created successfully
        if (!this.program) {
          throw new Error("Failed to create Anchor program instance");
        }

        // Set program for all services
        this.agents.setProgram(this.program);
        this.messages.setProgram(this.program);
        this.channels.setProgram(this.program);
        this.escrow.setProgram(this.program);
        this.analytics.setProgram(this.program);
        this.discovery.setProgram(this.program);
      } else {
        // No wallet provided - validate IDL before setting on services
        if (!IDL) {
          throw new Error(
            "IDL not found. Ensure the program IDL is properly generated and imported.",
          );
        }

        // Set IDL for all services
        this.agents.setIDL(IDL);
        this.messages.setIDL(IDL);
        this.channels.setIDL(IDL);
        this.escrow.setIDL(IDL);
        this.analytics.setIDL(IDL);
        this.discovery.setIDL(IDL);
      }

      // Validate initialization was successful
      if (!this.isInitialized()) {
        throw new Error(
          "Client initialization failed - services not properly configured",
        );
      }
    } catch (error: any) {
      throw new Error(`Client initialization failed: ${error.message}`);
    }
  }

  // ============================================================================
  // Legacy API Methods (for backward compatibility)
  // Delegate to appropriate services
  // ============================================================================

  /**
   * @deprecated Use client.agents.registerAgent() instead
   */
  async registerAgent(
    wallet: Signer,
    options: CreateAgentOptions,
  ): Promise<string> {
    return this.agents.registerAgent(wallet, options);
  }

  /**
   * @deprecated Use client.agents.updateAgent() instead
   */
  async updateAgent(
    wallet: Signer,
    options: UpdateAgentOptions,
  ): Promise<string> {
    return this.agents.updateAgent(wallet, options);
  }

  /**
   * @deprecated Use client.agents.getAgent() instead
   */
  async getAgent(walletPublicKey: PublicKey): Promise<AgentAccount | null> {
    return this.agents.getAgent(walletPublicKey);
  }

  /**
   * @deprecated Use client.agents.getAllAgents() instead
   */
  async getAllAgents(limit: number = 100): Promise<AgentAccount[]> {
    return this.agents.getAllAgents(limit);
  }

  /**
   * @deprecated Use client.messages.sendMessage() instead
   */
  async sendMessage(
    wallet: Signer,
    options: SendMessageOptions,
  ): Promise<string> {
    return this.messages.sendMessage(wallet, options);
  }

  /**
   * @deprecated Use client.messages.updateMessageStatus() instead
   */
  async updateMessageStatus(
    wallet: Signer,
    messagePDA: PublicKey,
    newStatus: MessageStatus,
  ): Promise<string> {
    return this.messages.updateMessageStatus(wallet, messagePDA, newStatus);
  }

  /**
   * @deprecated Use client.messages.getMessage() instead
   */
  async getMessage(messagePDA: PublicKey): Promise<MessageAccount | null> {
    return this.messages.getMessage(messagePDA);
  }

  /**
   * @deprecated Use client.messages.getAgentMessages() instead
   */
  async getAgentMessages(
    agentPublicKey: PublicKey,
    limit: number = 50,
    statusFilter?: MessageStatus,
  ): Promise<MessageAccount[]> {
    return this.messages.getAgentMessages(agentPublicKey, limit, statusFilter);
  }

  /**
   * @deprecated Use client.channels.createChannel() instead
   */
  async createChannel(
    wallet: Signer,
    options: CreateChannelOptions,
  ): Promise<string> {
    return this.channels.createChannel(wallet, options);
  }

  /**
   * @deprecated Use client.channels.getChannel() instead
   */
  async getChannel(channelPDA: PublicKey): Promise<ChannelAccount | null> {
    return this.channels.getChannel(channelPDA);
  }

  /**
   * @deprecated Use client.channels.getAllChannels() instead
   */
  async getAllChannels(
    limit: number = 50,
    visibilityFilter?: ChannelVisibility,
  ): Promise<ChannelAccount[]> {
    return this.channels.getAllChannels(limit, visibilityFilter);
  }

  /**
   * @deprecated Use client.channels.getChannelsByCreator() instead
   */
  async getChannelsByCreator(
    creator: PublicKey,
    limit: number = 50,
  ): Promise<ChannelAccount[]> {
    return this.channels.getChannelsByCreator(creator, limit);
  }

  /**
   * @deprecated Use client.channels.joinChannel() instead
   */
  async joinChannel(wallet: Signer, channelPDA: PublicKey): Promise<string> {
    return this.channels.joinChannel(wallet, channelPDA);
  }

  /**
   * @deprecated Use client.channels.leaveChannel() instead
   */
  async leaveChannel(wallet: Signer, channelPDA: PublicKey): Promise<string> {
    return this.channels.leaveChannel(wallet, channelPDA);
  }

  /**
   * @deprecated Use client.channels.broadcastMessage() instead
   */
  async broadcastMessage(
    wallet: Signer,
    channelPDA: PublicKey,
    content: string,
    messageType: string = "Text",
    replyTo?: PublicKey
  ): Promise<string> {
    return this.channels.broadcastMessage(wallet, {
      channelPDA,
      content,
      messageType,
      replyTo,
    });
  }

  /**
   * @deprecated Use client.channels.inviteToChannel() instead
   */
  async inviteToChannel(
    wallet: Signer,
    channelPDA: PublicKey,
    invitee: PublicKey,
  ): Promise<string> {
    return this.channels.inviteToChannel(wallet, channelPDA, invitee);
  }

  /**
   * @deprecated Use client.channels.getChannelParticipants() instead
   */
  async getChannelParticipants(
    channelPDA: PublicKey,
    limit: number = 50
  ): Promise<Array<IdlAccounts<PodCom>>> {
    return this.channels.getChannelParticipants(channelPDA, limit);
  }

  /**
   * @deprecated Use client.channels.getChannelMessages() instead
   */
  async getChannelMessages(
    channelPDA: PublicKey,
    limit: number = 50
  ): Promise<Array<IdlAccounts<PodCom>>> {
    return this.channels.getChannelMessages(channelPDA, limit);
  }

  /**
   * @deprecated Use client.escrow.depositEscrow() instead
   */
  async depositEscrow(
    wallet: Signer,
    options: DepositEscrowOptions,
  ): Promise<string> {
    return this.escrow.depositEscrow(wallet, options);
  }

  /**
   * @deprecated Use client.escrow.withdrawEscrow() instead
   */
  async withdrawEscrow(
    wallet: Signer,
    options: WithdrawEscrowOptions,
  ): Promise<string> {
    return this.escrow.withdrawEscrow(wallet, options);
  }

  /**
   * @deprecated Use client.escrow.getEscrow() instead
   */
  async getEscrow(
    channel: PublicKey,
    depositor: PublicKey,
  ): Promise<EscrowAccount | null> {
    return this.escrow.getEscrow(channel, depositor);
  }

  /**
   * @deprecated Use client.escrow.getEscrowsByDepositor() instead
   */
  async getEscrowsByDepositor(
    depositor: PublicKey,
    limit: number = 50,
  ): Promise<EscrowAccount[]> {
    return this.escrow.getEscrowsByDepositor(depositor, limit);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get the program ID
   */
  getProgramId(): PublicKey {
    return this.programId;
  }

  /**
   * Get the commitment level
   */
  getCommitment(): Commitment {
    return this.commitment;
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    // For wallet-based initialization, check if program is set
    if (this.program) {
      return true;
    }

    // For read-only initialization, check if services have IDL set
    return (
      this.agents.hasIDL() &&
      this.messages.hasIDL() &&
      this.channels.hasIDL() &&
      this.escrow.hasIDL() &&
      this.analytics.hasIDL() &&
      this.discovery.hasIDL()
    );
  }
}
