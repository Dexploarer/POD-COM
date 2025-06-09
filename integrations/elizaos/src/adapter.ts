/**
 * ElizaOS Agent Adapter for POD-COM Network
 * 
 * This adapter allows ElizaOS agents to participate in the POD-COM network,
 * handling message conversion, registration, and lifecycle management.
 */

import {
  PodComClient,
  createPodComClient,
  MessageType,
  MessageInfo,
  PublicKey,
  Connection,
  Keypair
} from '@pod-com/sdk';
import { Wallet } from '@coral-xyz/anchor';
import { v4 as uuidv4 } from 'uuid';

// ElizaOS interfaces (mock definitions - replace with actual imports)
interface ElizaAgent {
  id: string;
  name: string;
  description?: string;
  actions: ElizaAction[];
  evaluators: ElizaEvaluator[];
  providers: ElizaProvider[];
  plugins: ElizaPlugin[];
  clients: ElizaClient[];
}

interface ElizaRuntime {
  agentId: string;
  processAction: (action: ElizaAction, message: ElizaMessage) => Promise<ElizaResponse>;
  processEvaluator: (evaluator: ElizaEvaluator, message: ElizaMessage) => Promise<boolean>;
  composeState: (message: ElizaMessage) => Promise<ElizaState>;
}

interface ElizaMessage {
  id: string;
  userId: string;
  content: {
    text: string;
    attachments?: any[];
    metadata?: any;
  };
  timestamp: number;
  roomId?: string;
}

interface ElizaResponse {
  text: string;
  action?: string;
  attachments?: any[];
  metadata?: any;
}

interface ElizaAction {
  name: string;
  description: string;
  handler: (runtime: ElizaRuntime, message: ElizaMessage) => Promise<ElizaResponse>;
  validate?: (runtime: ElizaRuntime, message: ElizaMessage) => Promise<boolean>;
  examples?: Array<{ user: string; content: ElizaResponse }>;
}

interface ElizaEvaluator {
  name: string;
  description: string;
  evaluate: (runtime: ElizaRuntime, message: ElizaMessage) => Promise<boolean>;
}

interface ElizaProvider {
  name: string;
  get: (runtime: ElizaRuntime, message: ElizaMessage) => Promise<any>;
}

interface ElizaPlugin {
  name: string;
  description: string;
  actions?: ElizaAction[];
  evaluators?: ElizaEvaluator[];
  providers?: ElizaProvider[];
}

interface ElizaClient {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface ElizaState {
  agentId: string;
  userId: string;
  roomId?: string;
  userState?: any;
  agentState?: any;
  recentMessages: ElizaMessage[];
}

/**
 * Configuration for ElizaOS POD-COM integration
 */
export interface ElizaPodComConfig {
  connection: Connection;
  wallet: Wallet;
  programId: PublicKey;
  elizaAgent: ElizaAgent;
  elizaRuntime: ElizaRuntime;
  podComSettings?: {
    feePerMessage?: number;
    capabilities?: string[];
    endpointUrl?: string;
    autoRegister?: boolean;
  };
}

/**
 * ElizaOS Agent Adapter for POD-COM Network
 * 
 * Bridges ElizaOS agents with POD-COM messaging system
 */
export class ElizaPodComAdapter {
  private podComClient: PodComClient;
  private elizaAgent: ElizaAgent;
  private elizaRuntime: ElizaRuntime;
  private agentPda?: PublicKey;
  private activeChannels: Set<string> = new Set();
  private messageCache: Map<string, ElizaMessage> = new Map();
  private config: ElizaPodComConfig;

  constructor(config: ElizaPodComConfig) {
    this.config = config;
    this.elizaAgent = config.elizaAgent;
    this.elizaRuntime = config.elizaRuntime;
    
    this.podComClient = createPodComClient({
      connection: config.connection,
      wallet: config.wallet,
      programId: config.programId,
    });
  }

  /**
   * Initialize the ElizaOS agent on POD-COM network
   */
  async initialize(): Promise<void> {
    console.log(`🤖 Initializing ElizaOS agent "${this.elizaAgent.name}" on POD-COM...`);

    try {
      // Check if agent already exists
      const existingAgent = await this.podComClient.getAgent(this.config.wallet.publicKey);
      
      if (!existingAgent && this.config.podComSettings?.autoRegister !== false) {
        await this.registerAgent();
      } else if (existingAgent) {
        console.log(`✅ ElizaOS agent already registered on POD-COM`);
        const [agentPda] = this.podComClient.getAgentPDA(this.config.wallet.publicKey);
        this.agentPda = agentPda;
      }

      // Start message processing
      this.startMessageProcessing();
      
      console.log(`🚀 ElizaOS agent "${this.elizaAgent.name}" is now active on POD-COM`);
      
    } catch (error) {
      console.error('❌ Failed to initialize ElizaOS agent on POD-COM:', error);
      throw error;
    }
  }

  /**
   * Register the ElizaOS agent on POD-COM network
   */
  private async registerAgent(): Promise<void> {
    const capabilities = this.extractCapabilities();
    const settings = this.config.podComSettings || {};

    const { signature, agentPda } = await this.podComClient.registerAgent({
      name: this.elizaAgent.name,
      capabilities,
      endpointUrl: settings.endpointUrl,
      feePerMessage: settings.feePerMessage || 1000,
    });

    this.agentPda = agentPda;
    
    console.log(`✅ ElizaOS agent registered on POD-COM:`);
    console.log(`   Transaction: ${signature}`);
    console.log(`   Agent PDA: ${agentPda.toString()}`);
    console.log(`   Capabilities: ${capabilities.join(', ')}`);
  }

  /**
   * Extract capabilities from ElizaOS agent definition
   */
  private extractCapabilities(): string[] {
    const capabilities = new Set<string>();
    
    // Add capabilities from agent description and actions
    if (this.elizaAgent.description) {
      // Extract capability keywords from description
      const keywords = ['chat', 'analysis', 'trading', 'research', 'coding', 'creative'];
      keywords.forEach(keyword => {
        if (this.elizaAgent.description!.toLowerCase().includes(keyword)) {
          capabilities.add(keyword);
        }
      });
    }
    
    // Add capabilities from actions
    this.elizaAgent.actions.forEach(action => {
      // Convert action names to capabilities
      const capability = this.actionNameToCapability(action.name);
      if (capability) capabilities.add(capability);
    });
    
    // Add capabilities from plugins
    this.elizaAgent.plugins.forEach(plugin => {
      const capability = this.pluginNameToCapability(plugin.name);
      if (capability) capabilities.add(capability);
    });
    
    // Default capabilities
    if (capabilities.size === 0) {
      capabilities.add('chat');
      capabilities.add('assistant');
    }

    // Add from config override
    if (this.config.podComSettings?.capabilities) {
      this.config.podComSettings.capabilities.forEach(cap => capabilities.add(cap));
    }

    return Array.from(capabilities);
  }

  private actionNameToCapability(actionName: string): string | null {
    const mapping: { [key: string]: string } = {
      'trade': 'trading',
      'analyze': 'analysis',
      'research': 'research',
      'code': 'coding',
      'write': 'creative',
      'generate': 'creative',
      'chat': 'chat',
      'respond': 'chat',
    };

    for (const [key, capability] of Object.entries(mapping)) {
      if (actionName.toLowerCase().includes(key)) {
        return capability;
      }
    }

    return null;
  }

  private pluginNameToCapability(pluginName: string): string | null {
    const mapping: { [key: string]: string } = {
      'trading': 'trading',
      'analysis': 'analysis',
      'research': 'research',
      'code': 'coding',
      'creative': 'creative',
      'chat': 'chat',
      'web3': 'blockchain',
      'defi': 'trading',
    };

    for (const [key, capability] of Object.entries(mapping)) {
      if (pluginName.toLowerCase().includes(key)) {
        return capability;
      }
    }

    return null;
  }

  /**
   * Start processing POD-COM messages with ElizaOS runtime
   */
  private startMessageProcessing(): void {
    console.log('👂 Starting POD-COM message processing for ElizaOS agent...');
    
    // In a real implementation, this would subscribe to on-chain events
    // For now, we'll simulate the message processing setup
    
    // TODO: Implement actual message subscription
    // This would involve:
    // 1. Subscribing to POD-COM program logs
    // 2. Filtering for messages addressed to this agent
    // 3. Converting POD-COM messages to ElizaOS format
    // 4. Processing with ElizaOS runtime
    // 5. Converting responses back to POD-COM format
  }

  /**
   * Process a POD-COM message with ElizaOS runtime
   */
  async processPodComMessage(podComMessage: MessageInfo): Promise<void> {
    try {
      // Convert POD-COM message to ElizaOS format
      const elizaMessage = this.convertPodComToEliza(podComMessage);
      
      // Store message in cache
      this.messageCache.set(elizaMessage.id, elizaMessage);
      
      // Process with ElizaOS runtime
      await this.processElizaMessage(elizaMessage, podComMessage.channelId);
      
    } catch (error) {
      console.error('❌ Error processing POD-COM message with ElizaOS:', error);
      await this.sendErrorResponse(podComMessage.channelId, podComMessage.sender, error);
    }
  }

  /**
   * Process message through ElizaOS runtime
   */
  private async processElizaMessage(elizaMessage: ElizaMessage, channelId: PublicKey): Promise<void> {
    // Compose state for ElizaOS runtime
    const state = await this.elizaRuntime.composeState(elizaMessage);
    
    // Find matching action
    const action = await this.findMatchingAction(elizaMessage);
    
    if (action) {
      // Process with action
      const response = await this.elizaRuntime.processAction(action, elizaMessage);
      await this.sendElizaResponse(response, channelId, elizaMessage);
    } else {
      // No specific action, try general chat response
      const chatAction = this.findChatAction();
      if (chatAction) {
        const response = await this.elizaRuntime.processAction(chatAction, elizaMessage);
        await this.sendElizaResponse(response, channelId, elizaMessage);
      } else {
        // Send help message
        await this.sendHelpMessage(channelId, elizaMessage);
      }
    }
  }

  /**
   * Find matching ElizaOS action for the message
   */
  private async findMatchingAction(message: ElizaMessage): Promise<ElizaAction | null> {
    for (const action of this.elizaAgent.actions) {
      if (action.validate) {
        const isValid = await action.validate(this.elizaRuntime, message);
        if (isValid) return action;
      } else {
        // Simple text matching if no validator
        if (message.content.text.toLowerCase().includes(action.name.toLowerCase())) {
          return action;
        }
      }
    }
    return null;
  }

  /**
   * Find general chat action
   */
  private findChatAction(): ElizaAction | null {
    return this.elizaAgent.actions.find(action => 
      action.name.toLowerCase().includes('chat') || 
      action.name.toLowerCase().includes('respond')
    ) || null;
  }

  /**
   * Send ElizaOS response back to POD-COM network
   */
  private async sendElizaResponse(
    elizaResponse: ElizaResponse, 
    channelId: PublicKey, 
    originalMessage: ElizaMessage
  ): Promise<void> {
    try {
      const { messageType, content, metadata } = this.convertElizaToPodCom(elizaResponse);
      
      const contentHash = new TextEncoder().encode(content);
      
      await this.podComClient.sendMessage({
        channelId,
        messageType,
        contentHash,
        metadata: JSON.stringify({
          ...metadata,
          elizaAgent: this.elizaAgent.name,
          originalMessageId: originalMessage.id,
          timestamp: Date.now(),
        }),
        recipientAgent: originalMessage.userId ? new PublicKey(originalMessage.userId) : undefined,
      });
      
      console.log(`📤 Sent ElizaOS response to POD-COM channel`);
      
    } catch (error) {
      console.error('❌ Failed to send ElizaOS response:', error);
    }
  }

  /**
   * Convert POD-COM message to ElizaOS format
   */
  private convertPodComToEliza(podComMessage: MessageInfo): ElizaMessage {
    const metadata = JSON.parse(podComMessage.metadata);
    
    return {
      id: uuidv4(),
      userId: podComMessage.sender.toString(),
      content: {
        text: metadata.content || podComMessage.contentHash.toString(),
        metadata: metadata,
      },
      timestamp: podComMessage.timestamp.getTime(),
      roomId: podComMessage.channelId.toString(),
    };
  }

  /**
   * Convert ElizaOS response to POD-COM format
   */
  private convertElizaToPodCom(elizaResponse: ElizaResponse): {
    messageType: MessageType;
    content: string;
    metadata: any;
  } {
    // Determine message type based on response content
    let messageType: MessageType = { plainText: {} };
    
    if (elizaResponse.action) {
      messageType = { functionCall: {} };
    } else if (elizaResponse.attachments && elizaResponse.attachments.length > 0) {
      messageType = { media: {} };
    }
    
    return {
      messageType,
      content: elizaResponse.text,
      metadata: {
        type: 'eliza_response',
        action: elizaResponse.action,
        attachments: elizaResponse.attachments,
        elizaMetadata: elizaResponse.metadata,
      },
    };
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(channelId: PublicKey, originalMessage: ElizaMessage): Promise<void> {
    const helpText = `🤖 ${this.elizaAgent.name} Help\n\nAvailable actions:\n${
      this.elizaAgent.actions.map(action => 
        `• ${action.name}: ${action.description}`
      ).join('\n')
    }`;

    const contentHash = new TextEncoder().encode(helpText);
    
    await this.podComClient.sendMessage({
      channelId,
      messageType: { plainText: {} },
      contentHash,
      metadata: JSON.stringify({
        type: 'help',
        elizaAgent: this.elizaAgent.name,
        timestamp: Date.now(),
      }),
      recipientAgent: new PublicKey(originalMessage.userId),
    });
  }

  /**
   * Send error response
   */
  private async sendErrorResponse(
    channelId: PublicKey, 
    recipient: PublicKey, 
    error: any
  ): Promise<void> {
    const errorText = `❌ Sorry, I encountered an error processing your request: ${error.message}`;
    const contentHash = new TextEncoder().encode(errorText);
    
    await this.podComClient.sendMessage({
      channelId,
      messageType: { plainText: {} },
      contentHash,
      metadata: JSON.stringify({
        type: 'error',
        error: error.message,
        elizaAgent: this.elizaAgent.name,
        timestamp: Date.now(),
      }),
      recipientAgent: recipient,
    });
  }

  /**
   * Join a POD-COM channel
   */
  async joinChannel(channelId: PublicKey): Promise<void> {
    this.activeChannels.add(channelId.toString());
    console.log(`📺 ElizaOS agent joined POD-COM channel: ${channelId.toString()}`);
  }

  /**
   * Leave a POD-COM channel
   */
  async leaveChannel(channelId: PublicKey): Promise<void> {
    this.activeChannels.delete(channelId.toString());
    console.log(`👋 ElizaOS agent left POD-COM channel: ${channelId.toString()}`);
  }

  /**
   * Get agent statistics
   */
  async getStats(): Promise<any> {
    const agent = await this.podComClient.getAgent(this.config.wallet.publicKey);
    const reputation = await this.podComClient.getReputation(this.config.wallet.publicKey);
    
    return {
      elizaAgent: {
        name: this.elizaAgent.name,
        actionsCount: this.elizaAgent.actions.length,
        pluginsCount: this.elizaAgent.plugins.length,
      },
      podComAgent: agent,
      reputation,
      activeChannels: Array.from(this.activeChannels),
      messagesCached: this.messageCache.size,
    };
  }

  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    console.log(`👋 Shutting down ElizaOS agent "${this.elizaAgent.name}" on POD-COM...`);
    
    // Stop ElizaOS clients
    for (const client of this.elizaAgent.clients) {
      await client.stop();
    }
    
    // Clear caches
    this.messageCache.clear();
    this.activeChannels.clear();
    
    console.log(`✅ ElizaOS agent shutdown complete`);
  }
}

/**
 * Create ElizaOS POD-COM adapter
 */
export function createElizaPodComAdapter(config: ElizaPodComConfig): ElizaPodComAdapter {
  return new ElizaPodComAdapter(config);
}
