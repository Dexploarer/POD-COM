import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { PodCom } from './types/pod_com';
import { 
  Agent, 
  Channel, 
  Message, 
  Reputation,
  MessageType,
  ReputationType,
  EscrowAction 
} from './types';

export interface PodComClientConfig {
  connection: Connection;
  wallet: Wallet;
  programId: PublicKey;
  cluster?: 'localnet' | 'devnet' | 'mainnet-beta';
}

/**
 * Main client class for interacting with the POD-COM protocol
 */
export class PodComClient {
  private connection: Connection;
  private provider: AnchorProvider;
  private program: Program<PodCom>;
  private wallet: Wallet;

  constructor(config: PodComClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.provider = new AnchorProvider(this.connection, this.wallet, {});
    
    // TODO: Load actual program IDL
    this.program = new Program(
      {} as PodCom, // Placeholder IDL
      config.programId,
      this.provider
    );
  }

  /**
   * Register a new agent in the POD-COM network
   */
  async registerAgent(params: {
    name: string;
    capabilities: string[];
    endpointUrl?: string;
    feePerMessage: number;
  }): Promise<{ signature: string; agentPda: PublicKey }> {
    const [agentPda] = this.getAgentPDA(this.wallet.publicKey);
    const [reputationPda] = this.getReputationPDA(this.wallet.publicKey);

    const tx = await this.program.methods
      .registerAgent(
        params.name,
        params.capabilities,
        params.endpointUrl || null,
        params.feePerMessage
      )
      .accounts({
        agent: agentPda,
        reputation: reputationPda,
        owner: this.wallet.publicKey,
        systemProgram: PublicKey.default, // Replace with actual system program ID
      })
      .rpc();

    return { signature: tx, agentPda };
  }

  /**
   * Create a new communication channel
   */
  async createChannel(params: {
    isPrivate: boolean;
    initialEscrow: number;
    maxParticipants: number;
  }): Promise<{ signature: string; channelPda: PublicKey }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const [channelPda] = this.getChannelPDA(this.wallet.publicKey, timestamp);
    const [escrowPda] = this.getEscrowPDA(channelPda);
    const [statsPda] = this.getMessageStatsPDA(channelPda);

    const tx = await this.program.methods
      .createChannel(
        params.isPrivate,
        params.initialEscrow,
        params.maxParticipants
      )
      .accounts({
        channel: channelPda,
        escrowAccount: escrowPda,
        messageStats: statsPda,
        creator: this.wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .rpc();

    return { signature: tx, channelPda };
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(params: {
    channelId: PublicKey;
    messageType: MessageType;
    contentHash: Uint8Array;
    metadata: string;
    recipientAgent?: PublicKey;
  }): Promise<{ signature: string; messagePda: PublicKey }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const [senderAgentPda] = this.getAgentPDA(this.wallet.publicKey);
    const [messagePda] = this.getMessagePDA(
      params.channelId,
      senderAgentPda,
      timestamp
    );
    const [escrowPda] = this.getEscrowPDA(params.channelId);
    const [statsPda] = this.getMessageStatsPDA(params.channelId);

    const accounts: any = {
      message: messagePda,
      channel: params.channelId,
      escrowAccount: escrowPda,
      senderAgent: senderAgentPda,
      messageStats: statsPda,
      sender: this.wallet.publicKey,
      systemProgram: PublicKey.default,
    };

    if (params.recipientAgent) {
      const [recipientAgentPda] = this.getAgentPDA(params.recipientAgent);
      accounts.recipientAgent = recipientAgentPda;
    }

    const tx = await this.program.methods
      .sendMessage(
        params.messageType,
        Array.from(params.contentHash),
        params.metadata
      )
      .accounts(accounts)
      .rpc();

    return { signature: tx, messagePda };
  }

  /**
   * Update agent reputation
   */
  async updateReputation(params: {
    targetAgent: PublicKey;
    rating: number;
    reviewType: ReputationType;
  }): Promise<string> {
    const [reviewerAgentPda] = this.getAgentPDA(this.wallet.publicKey);
    const [reviewerReputationPda] = this.getReputationPDA(this.wallet.publicKey);
    const [targetAgentPda] = this.getAgentPDA(params.targetAgent);
    const [targetReputationPda] = this.getReputationPDA(params.targetAgent);

    return await this.program.methods
      .updateReputation(params.rating, params.reviewType)
      .accounts({
        reviewerAgent: reviewerAgentPda,
        reviewerReputation: reviewerReputationPda,
        targetAgent: targetAgentPda,
        targetReputation: targetReputationPda,
        reviewer: this.wallet.publicKey,
      })
      .rpc();
  }

  /**
   * Manage channel escrow (deposit, withdraw, redistribute)
   */
  async manageEscrow(params: {
    channelId: PublicKey;
    action: EscrowAction;
    amount: number;
  }): Promise<string> {
    const [escrowPda] = this.getEscrowPDA(params.channelId);

    return await this.program.methods
      .manageEscrow(params.action, params.amount)
      .accounts({
        channel: params.channelId,
        escrowAccount: escrowPda,
        authority: this.wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .rpc();
  }

  /**
   * Fetch agent account data
   */
  async getAgent(agentOwner: PublicKey): Promise<Agent | null> {
    try {
      const [agentPda] = this.getAgentPDA(agentOwner);
      return await this.program.account.agent.fetch(agentPda);
    } catch {
      return null;
    }
  }

  /**
   * Fetch channel account data
   */
  async getChannel(channelId: PublicKey): Promise<Channel | null> {
    try {
      return await this.program.account.channel.fetch(channelId);
    } catch {
      return null;
    }
  }

  /**
   * Fetch message account data
   */
  async getMessage(messageId: PublicKey): Promise<Message | null> {
    try {
      return await this.program.account.message.fetch(messageId);
    } catch {
      return null;
    }
  }

  /**
   * Fetch reputation account data
   */
  async getReputation(agentOwner: PublicKey): Promise<Reputation | null> {
    try {
      const [reputationPda] = this.getReputationPDA(agentOwner);
      return await this.program.account.reputation.fetch(reputationPda);
    } catch {
      return null;
    }
  }

  // PDA Helper Methods

  getAgentPDA(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer()],
      this.program.programId
    );
  }

  getReputationPDA(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), owner.toBuffer()],
      this.program.programId
    );
  }

  getChannelPDA(creator: PublicKey, timestamp: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('channel'),
        creator.toBuffer(),
        Buffer.from(timestamp.toString()),
      ],
      this.program.programId
    );
  }

  getEscrowPDA(channelId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), channelId.toBuffer()],
      this.program.programId
    );
  }

  getMessagePDA(
    channelId: PublicKey,
    sender: PublicKey,
    timestamp: number
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('message'),
        channelId.toBuffer(),
        sender.toBuffer(),
        Buffer.from(timestamp.toString()),
      ],
      this.program.programId
    );
  }

  getMessageStatsPDA(channelId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('stats'), channelId.toBuffer()],
      this.program.programId
    );
  }
}

/**
 * Create a new PodComClient instance
 */
export function createPodComClient(config: PodComClientConfig): PodComClient {
  return new PodComClient(config);
}
