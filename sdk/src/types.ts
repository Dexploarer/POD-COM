import { PublicKey } from '@solana/web3.js';

// Core account types matching the Anchor program

export interface Agent {
  agentId: PublicKey;
  name: string;
  capabilities: string[];
  endpointUrl: string | null;
  feePerMessage: number;
  owner: PublicKey;
  createdAt: number;
  lastActive: number;
  isActive: boolean;
  messagesSent: number;
  messagesReceived: number;
  feesEarned: number;
  feesSpent: number;
  reputationScore: number;
  reviewCount: number;
}

export interface Channel {
  channelId: PublicKey;
  creator: PublicKey;
  participants: PublicKey[];
  isPrivate: boolean;
  maxParticipants: number;
  escrowAccount: PublicKey;
  escrowBalance: number;
  feePerMessage: number | null;
  messageCount: number;
  createdAt: number;
  lastMessageAt: number;
  isActive: boolean;
  metadata: string;
}

export interface Message {
  messageId: PublicKey;
  channelId: PublicKey;
  sender: PublicKey;
  recipient: PublicKey | null;
  messageType: MessageType;
  contentHash: number[];
  metadata: string;
  feePaid: number;
  timestamp: number;
  acknowledged: boolean;
  responseTo: PublicKey | null;
}

export interface Reputation {
  agentId: PublicKey;
  overallScore: number;
  responseTimeScore: number;
  accuracyScore: number;
  helpfulnessScore: number;
  reliabilityScore: number;
  costEfficiencyScore: number;
  totalReviews: number;
  responseTimeReviews: number;
  accuracyReviews: number;
  helpfulnessReviews: number;
  reliabilityReviews: number;
  costEfficiencyReviews: number;
  penaltyCount: number;
  totalPenalties: number;
  lastReviewAt: number;
  createdAt: number;
}

export interface MessageStats {
  channelId: PublicKey;
  totalMessages: number;
  plainTextCount: number;
  functionCallCount: number;
  dataStreamCount: number;
  workflowCount: number;
  aiPromptCount: number;
  mediaCount: number;
  codeCount: number;
  totalFees: number;
  avgFee: number;
  lastUpdated: number;
}

// Enum types

export type MessageType = 
  | { plainText: {} }
  | { functionCall: {} }
  | { dataStream: {} }
  | { workflow: {} }
  | { aiPrompt: {} }
  | { media: {} }
  | { code: {} };

export type ReputationType =
  | { responseTime: {} }
  | { accuracy: {} }
  | { helpfulness: {} }
  | { reliability: {} }
  | { costEfficiency: {} };

export type EscrowAction =
  | { deposit: {} }
  | { withdraw: {} }
  | { redistribute: {} };

// Helper types for SDK

export interface AgentProfile {
  publicKey: PublicKey;
  name: string;
  capabilities: string[];
  endpointUrl?: string;
  reputation: {
    overall: number;
    breakdown: {
      responseTime: number;
      accuracy: number;
      helpfulness: number;
      reliability: number;
      costEfficiency: number;
    };
    reviewCount: number;
  };
  activity: {
    messagesSent: number;
    messagesReceived: number;
    feesEarned: number;
    feesSpent: number;
    lastActive: Date;
  };
}

export interface ChannelInfo {
  id: PublicKey;
  name?: string;
  creator: PublicKey;
  participants: PublicKey[];
  isPrivate: boolean;
  messageCount: number;
  escrowBalance: number;
  lastActivity: Date;
  stats: {
    totalMessages: number;
    messageTypes: Record<string, number>;
    avgFeePerMessage: number;
  };
}

export interface MessageInfo {
  id: PublicKey;
  channelId: PublicKey;
  sender: PublicKey;
  recipient?: PublicKey;
  type: string;
  contentHash: string;
  metadata: any;
  feePaid: number;
  timestamp: Date;
  acknowledged: boolean;
  isResponse: boolean;
}

export interface NetworkStats {
  totalAgents: number;
  activeAgents: number;
  totalChannels: number;
  activeChannels: number;
  totalMessages: number;
  messagesLast24h: number;
  totalFeesCollected: number;
  avgReputationScore: number;
  networkTPS: number;
}

// Error types

export class PodComError extends Error {
  constructor(
    message: string,
    public code: string,
    public programError?: any
  ) {
    super(message);
    this.name = 'PodComError';
  }
}

export class AgentNotFoundError extends PodComError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, 'AGENT_NOT_FOUND');
  }
}

export class ChannelNotFoundError extends PodComError {
  constructor(channelId: string) {
    super(`Channel not found: ${channelId}`, 'CHANNEL_NOT_FOUND');
  }
}

export class InsufficientEscrowError extends PodComError {
  constructor(required: number, available: number) {
    super(
      `Insufficient escrow: required ${required}, available ${available}`,
      'INSUFFICIENT_ESCROW'
    );
  }
}

export class UnauthorizedError extends PodComError {
  constructor(action: string) {
    super(`Unauthorized action: ${action}`, 'UNAUTHORIZED');
  }
}

// Event types for real-time subscriptions

export interface AgentRegisteredEvent {
  type: 'AgentRegistered';
  agentId: PublicKey;
  name: string;
  capabilities: string[];
  timestamp: Date;
}

export interface ChannelCreatedEvent {
  type: 'ChannelCreated';
  channelId: PublicKey;
  creator: PublicKey;
  isPrivate: boolean;
  maxParticipants: number;
  timestamp: Date;
}

export interface MessageSentEvent {
  type: 'MessageSent';
  messageId: PublicKey;
  channelId: PublicKey;
  sender: PublicKey;
  recipient?: PublicKey;
  messageType: MessageType;
  feePaid: number;
  timestamp: Date;
}

export interface ReputationUpdatedEvent {
  type: 'ReputationUpdated';
  agentId: PublicKey;
  reviewer: PublicKey;
  reviewType: ReputationType;
  rating: number;
  newOverallScore: number;
  timestamp: Date;
}

export type PodComEvent = 
  | AgentRegisteredEvent
  | ChannelCreatedEvent
  | MessageSentEvent
  | ReputationUpdatedEvent;

// Utility types

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterOptions {
  isActive?: boolean;
  minReputation?: number;
  capabilities?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface SearchOptions extends PaginationOptions, FilterOptions {
  query?: string;
  includeInactive?: boolean;
}

// Configuration types

export interface PodComConfig {
  network: 'localnet' | 'devnet' | 'mainnet-beta';
  rpcUrl: string;
  programId: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

// Transaction result types

export interface TransactionResult {
  signature: string;
  slot: number;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
  err?: any;
}

export interface InstructionResult extends TransactionResult {
  accounts: {
    [key: string]: PublicKey;
  };
  data?: any;
}

// Placeholder for generated Anchor types
export interface PodCom {
  // This will be replaced with actual generated types from anchor build
  version: string;
  name: string;
  instructions: any[];
  accounts: any[];
  types: any[];
  events: any[];
  errors: any[];
}
