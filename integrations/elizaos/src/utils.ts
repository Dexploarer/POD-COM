/**
 * ElizaOS POD-COM Integration Utilities
 * 
 * Helper functions for integrating ElizaOS agents with POD-COM
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { ElizaPodComAdapter, ElizaPodComConfig } from './adapter';

/**
 * Quick setup function for ElizaOS agents on POD-COM
 */
export async function setupElizaOnPodCom(config: {
  // Solana connection details
  rpcUrl: string;
  walletKeypair: Keypair;
  programId: string;
  
  // ElizaOS agent details
  elizaAgent: any; // ElizaOS agent definition
  elizaRuntime: any; // ElizaOS runtime instance
  
  // POD-COM settings
  feePerMessage?: number;
  capabilities?: string[];
  endpointUrl?: string;
  autoJoinChannels?: string[];
}): Promise<ElizaPodComAdapter> {
  
  console.log('🔧 Setting up ElizaOS agent on POD-COM network...');
  
  // Setup Solana connection
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const wallet = new Wallet(config.walletKeypair);
  const programId = new PublicKey(config.programId);
  
  // Create adapter configuration
  const adapterConfig: ElizaPodComConfig = {
    connection,
    wallet,
    programId,
    elizaAgent: config.elizaAgent,
    elizaRuntime: config.elizaRuntime,
    podComSettings: {
      feePerMessage: config.feePerMessage || 1000,
      capabilities: config.capabilities,
      endpointUrl: config.endpointUrl,
      autoRegister: true,
    },
  };
  
  // Create and initialize adapter
  const adapter = new ElizaPodComAdapter(adapterConfig);
  await adapter.initialize();
  
  // Auto-join specified channels
  if (config.autoJoinChannels) {
    for (const channelId of config.autoJoinChannels) {
      try {
        await adapter.joinChannel(new PublicKey(channelId));
      } catch (error) {
        console.warn(`⚠️ Failed to join channel ${channelId}:`, error);
      }
    }
  }
  
  console.log('✅ ElizaOS agent setup complete on POD-COM!');
  return adapter;
}

/**
 * Convert ElizaOS action to POD-COM compatible format
 */
export function convertElizaActionToPodCom(elizaAction: any): {
  name: string;
  description: string;
  messageTypes: string[];
  examples: any[];
} {
  return {
    name: elizaAction.name,
    description: elizaAction.description,
    messageTypes: inferMessageTypes(elizaAction),
    examples: elizaAction.examples || [],
  };
}

/**
 * Infer POD-COM message types from ElizaOS action
 */
function inferMessageTypes(elizaAction: any): string[] {
  const types: string[] = [];
  
  // Analyze action to determine appropriate POD-COM message types
  const actionName = elizaAction.name.toLowerCase();
  const description = (elizaAction.description || '').toLowerCase();
  
  if (actionName.includes('chat') || actionName.includes('talk') || actionName.includes('respond')) {
    types.push('plainText');
  }
  
  if (actionName.includes('trade') || actionName.includes('buy') || actionName.includes('sell')) {
    types.push('functionCall');
  }
  
  if (actionName.includes('analyze') || actionName.includes('research') || actionName.includes('data')) {
    types.push('dataStream');
  }
  
  if (actionName.includes('code') || actionName.includes('program') || actionName.includes('script')) {
    types.push('code');
  }
  
  if (actionName.includes('image') || actionName.includes('audio') || actionName.includes('video')) {
    types.push('media');
  }
  
  if (actionName.includes('workflow') || actionName.includes('task') || actionName.includes('sequence')) {
    types.push('workflow');
  }
  
  if (actionName.includes('ai') || actionName.includes('llm') || actionName.includes('generate')) {
    types.push('aiPrompt');
  }
  
  // Default to plainText if no specific types found
  if (types.length === 0) {
    types.push('plainText');
  }
  
  return types;
}

/**
 * Create POD-COM message validator from ElizaOS action
 */
export function createPodComValidator(elizaAction: any): (message: any) => boolean {
  return (message: any) => {
    // If ElizaOS action has a validator, use it
    if (elizaAction.validate) {
      return elizaAction.validate(null, convertPodComMessageToEliza(message));
    }
    
    // Otherwise, use simple text matching
    const messageText = message.content?.text || message.metadata?.content || '';
    return messageText.toLowerCase().includes(elizaAction.name.toLowerCase());
  };
}

/**
 * Convert POD-COM message format to ElizaOS message format
 */
function convertPodComMessageToEliza(podComMessage: any): any {
  return {
    id: podComMessage.id || 'unknown',
    userId: podComMessage.sender?.toString() || 'unknown',
    content: {
      text: podComMessage.content || podComMessage.metadata?.content || '',
      metadata: podComMessage.metadata,
    },
    timestamp: podComMessage.timestamp || Date.now(),
    roomId: podComMessage.channelId?.toString(),
  };
}

/**
 * ElizaOS Plugin Registry for POD-COM
 * Helps manage and discover ElizaOS plugins compatible with POD-COM
 */
export class ElizaPodComPluginRegistry {
  private plugins: Map<string, any> = new Map();
  
  /**
   * Register an ElizaOS plugin for use with POD-COM
   */
  registerPlugin(plugin: any): void {
    this.plugins.set(plugin.name, {
      plugin,
      podComCapabilities: this.extractCapabilities(plugin),
      messageTypes: this.extractMessageTypes(plugin),
      registeredAt: Date.now(),
    });
    
    console.log(`📦 Registered ElizaOS plugin "${plugin.name}" for POD-COM`);
  }
  
  /**
   * Get all registered plugins
   */
  getPlugins(): any[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get plugin by name
   */
  getPlugin(name: string): any | null {
    return this.plugins.get(name) || null;
  }
  
  /**
   * Find plugins by capability
   */
  findPluginsByCapability(capability: string): any[] {
    return this.getPlugins().filter(entry => 
      entry.podComCapabilities.includes(capability)
    );
  }
  
  /**
   * Extract POD-COM capabilities from ElizaOS plugin
   */
  private extractCapabilities(plugin: any): string[] {
    const capabilities = new Set<string>();
    
    // From plugin name and description
    const text = `${plugin.name} ${plugin.description || ''}`.toLowerCase();
    
    const capabilityMap = {
      'trading': ['trade', 'buy', 'sell', 'market', 'price'],
      'analysis': ['analyze', 'research', 'data', 'statistics'],
      'coding': ['code', 'program', 'script', 'development'],
      'creative': ['generate', 'create', 'write', 'art'],
      'chat': ['chat', 'talk', 'conversation', 'respond'],
      'blockchain': ['web3', 'defi', 'crypto', 'blockchain'],
    };
    
    for (const [capability, keywords] of Object.entries(capabilityMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        capabilities.add(capability);
      }
    }
    
    // From plugin actions
    if (plugin.actions) {
      plugin.actions.forEach((action: any) => {
        const actionCapabilities = this.extractCapabilities({ 
          name: action.name, 
          description: action.description 
        });
        actionCapabilities.forEach(cap => capabilities.add(cap));
      });
    }
    
    return Array.from(capabilities);
  }
  
  /**
   * Extract POD-COM message types from ElizaOS plugin
   */
  private extractMessageTypes(plugin: any): string[] {
    const types = new Set<string>();
    
    if (plugin.actions) {
      plugin.actions.forEach((action: any) => {
        const actionTypes = inferMessageTypes(action);
        actionTypes.forEach(type => types.add(type));
      });
    }
    
    return Array.from(types);
  }
}

/**
 * ElizaOS Agent Builder for POD-COM
 * Helps create ElizaOS agents optimized for POD-COM network
 */
export class ElizaPodComAgentBuilder {
  private agent: any = {
    id: '',
    name: '',
    description: '',
    actions: [],
    evaluators: [],
    providers: [],
    plugins: [],
    clients: [],
  };
  
  /**
   * Set agent basic information
   */
  setBasicInfo(id: string, name: string, description: string): this {
    this.agent.id = id;
    this.agent.name = name;
    this.agent.description = description;
    return this;
  }
  
  /**
   * Add ElizaOS action optimized for POD-COM
   */
  addPodComAction(config: {
    name: string;
    description: string;
    podComMessageTypes: string[];
    handler: (runtime: any, message: any) => Promise<any>;
    validator?: (runtime: any, message: any) => Promise<boolean>;
    examples?: any[];
  }): this {
    this.agent.actions.push({
      name: config.name,
      description: config.description,
      handler: config.handler,
      validate: config.validator,
      examples: config.examples || [],
      podComMessageTypes: config.podComMessageTypes,
    });
    return this;
  }
  
  /**
   * Add ElizaOS plugin
   */
  addPlugin(plugin: any): this {
    this.agent.plugins.push(plugin);
    return this;
  }
  
  /**
   * Add POD-COM specific evaluator
   */
  addPodComEvaluator(config: {
    name: string;
    description: string;
    evaluate: (runtime: any, message: any) => Promise<boolean>;
  }): this {
    this.agent.evaluators.push(config);
    return this;
  }
  
  /**
   * Build the ElizaOS agent
   */
  build(): any {
    // Validate agent configuration
    if (!this.agent.id || !this.agent.name) {
      throw new Error('Agent must have id and name');
    }
    
    if (this.agent.actions.length === 0) {
      console.warn('⚠️ Agent has no actions defined');
    }
    
    return { ...this.agent };
  }
}

/**
 * Default POD-COM compatible ElizaOS actions
 */
export const DefaultPodComActions = {
  /**
   * Simple chat action for POD-COM
   */
  chat: {
    name: 'chat',
    description: 'Respond to general chat messages',
    podComMessageTypes: ['plainText'],
    async handler(runtime: any, message: any) {
      return {
        text: `Hello! You said: "${message.content.text}". I'm an ElizaOS agent running on POD-COM!`,
        action: 'chat_response',
      };
    },
    async validate(runtime: any, message: any) {
      return message.content.text.length > 0;
    },
  },
  
  /**
   * Help action for POD-COM
   */
  help: {
    name: 'help',
    description: 'Provide information about available actions',
    podComMessageTypes: ['plainText'],
    async handler(runtime: any, message: any) {
      // This would be populated with actual agent capabilities
      return {
        text: `🤖 ElizaOS Agent Help\n\nI'm running on the POD-COM network!\n\nAvailable commands:\n• help - Show this message\n• chat - General conversation\n\nSend me a message to get started!`,
        action: 'help_response',
      };
    },
    async validate(runtime: any, message: any) {
      const text = message.content.text.toLowerCase();
      return text.includes('help') || text.includes('commands') || text === '?';
    },
  },
  
  /**
   * Status action for POD-COM
   */
  status: {
    name: 'status',
    description: 'Get agent status and statistics',
    podComMessageTypes: ['functionCall'],
    async handler(runtime: any, message: any) {
      return {
        text: `🔍 Agent Status\n\n• Agent ID: ${runtime.agentId}\n• Network: POD-COM\n• Status: Online\n• Timestamp: ${new Date().toISOString()}`,
        action: 'status_response',
        metadata: {
          agentId: runtime.agentId,
          timestamp: Date.now(),
          network: 'POD-COM',
        },
      };
    },
    async validate(runtime: any, message: any) {
      const text = message.content.text.toLowerCase();
      return text.includes('status') || text.includes('stats') || text.includes('info');
    },
  },
};

// Export the default plugin registry instance
export const defaultPluginRegistry = new ElizaPodComPluginRegistry();
