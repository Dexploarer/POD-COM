/**
 * Example: Integrating an ElizaOS Agent with POD-COM
 * 
 * This example shows how to take an existing ElizaOS agent and make it
 * compatible with the POD-COM network for blockchain-based AI communication.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { 
  setupElizaOnPodCom,
  ElizaPodComAgentBuilder,
  DefaultPodComActions,
  defaultPluginRegistry
} from '../src/index';

// Mock ElizaOS imports (replace with actual ElizaOS imports)
// import { elizaLogger, createRuntime, ModelProviderName } from '@elizaos/core';
// import { DirectClient } from '@elizaos/client-direct';

/**
 * Example ElizaOS Agent Definition
 * This simulates what an existing ElizaOS agent might look like
 */
const exampleElizaAgent = {
  id: 'trading-assistant-v1',
  name: 'TradingAssistant',
  description: 'AI agent specialized in cryptocurrency trading analysis and market insights',
  
  // ElizaOS actions that we'll make compatible with POD-COM
  actions: [
    {
      name: 'analyze_market',
      description: 'Analyze cryptocurrency market trends and provide insights',
      async handler(runtime: any, message: any) {
        // Simulate market analysis
        const symbols = ['SOL', 'BTC', 'ETH'];
        const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        const price = (Math.random() * 1000 + 50).toFixed(2);
        const change = ((Math.random() - 0.5) * 20).toFixed(2);
        
        return {
          text: `📈 Market Analysis for ${randomSymbol}:\n\nCurrent Price: $${price}\n24h Change: ${change}%\n\nTechnical Analysis: ${change.startsWith('-') ? 'Bearish trend detected. Consider waiting for support levels.' : 'Bullish momentum building. Watch for breakout above resistance.'}`,
          action: 'market_analysis',
          metadata: {
            symbol: randomSymbol,
            price: parseFloat(price),
            change: parseFloat(change),
            timestamp: Date.now(),
          },
        };
      },
      async validate(runtime: any, message: any) {
        const text = message.content.text.toLowerCase();
        return text.includes('analyze') || text.includes('market') || text.includes('price');
      },
    },
    
    {
      name: 'trading_signal',
      description: 'Generate trading signals based on market conditions',
      async handler(runtime: any, message: any) {
        const signals = ['BUY', 'SELL', 'HOLD'];
        const signal = signals[Math.floor(Math.random() * signals.length)];
        const confidence = (Math.random() * 40 + 60).toFixed(1); // 60-100%
        
        return {
          text: `🚨 Trading Signal\n\nSignal: ${signal}\nConfidence: ${confidence}%\nTimeframe: 4H\n\nReason: Based on technical indicators and market sentiment analysis.`,
          action: 'trading_signal',
          metadata: {
            signal,
            confidence: parseFloat(confidence),
            timeframe: '4H',
            timestamp: Date.now(),
          },
        };
      },
      async validate(runtime: any, message: any) {
        const text = message.content.text.toLowerCase();
        return text.includes('signal') || text.includes('trade') || text.includes('buy') || text.includes('sell');
      },
    },
    
    {
      name: 'portfolio_advice',
      description: 'Provide portfolio management and diversification advice',
      async handler(runtime: any, message: any) {
        const advice = [
          'Consider diversifying across different market caps and sectors',
          'Dollar-cost averaging can help reduce volatility impact',
          'Keep some stablecoins for market opportunities',
          'Review and rebalance your portfolio quarterly',
          'Never invest more than you can afford to lose',
        ];
        
        const randomAdvice = advice[Math.floor(Math.random() * advice.length)];
        
        return {
          text: `💼 Portfolio Advice\n\n${randomAdvice}\n\nRemember: This is educational content, not financial advice. Always do your own research and consult with financial professionals.`,
          action: 'portfolio_advice',
          metadata: {
            advice: randomAdvice,
            timestamp: Date.now(),
          },
        };
      },
      async validate(runtime: any, message: any) {
        const text = message.content.text.toLowerCase();
        return text.includes('portfolio') || text.includes('advice') || text.includes('invest');
      },
    },
    
    // Add default POD-COM actions
    ...Object.values(DefaultPodComActions),
  ],
  
  evaluators: [
    {
      name: 'trading_context',
      description: 'Evaluate if message is trading-related',
      async evaluate(runtime: any, message: any) {
        const tradingKeywords = ['trade', 'buy', 'sell', 'market', 'price', 'crypto', 'bitcoin', 'ethereum', 'solana'];
        const text = message.content.text.toLowerCase();
        return tradingKeywords.some(keyword => text.includes(keyword));
      },
    },
  ],
  
  providers: [
    {
      name: 'market_data',
      async get(runtime: any, message: any) {
        // Mock market data provider
        return {
          btc: { price: 45000 + Math.random() * 10000, change: (Math.random() - 0.5) * 10 },
          eth: { price: 2500 + Math.random() * 1000, change: (Math.random() - 0.5) * 10 },
          sol: { price: 80 + Math.random() * 40, change: (Math.random() - 0.5) * 10 },
        };
      },
    },
  ],
  
  plugins: [
    {
      name: 'trading_plugin',
      description: 'Enhanced trading capabilities',
      actions: [], // Additional actions from plugin
      evaluators: [], // Additional evaluators from plugin
      providers: [], // Additional providers from plugin
    },
  ],
  
  clients: [], // ElizaOS clients (Discord, Telegram, etc.)
};

/**
 * Example ElizaOS Runtime
 * This simulates how an ElizaOS runtime would work
 */
class MockElizaRuntime {
  agentId: string;
  
  constructor(agentId: string) {
    this.agentId = agentId;
  }
  
  async processAction(action: any, message: any) {
    console.log(`🧠 Processing action "${action.name}" with ElizaOS runtime`);
    return await action.handler(this, message);
  }
  
  async processEvaluator(evaluator: any, message: any) {
    return await evaluator.evaluate(this, message);
  }
  
  async composeState(message: any) {
    return {
      agentId: this.agentId,
      userId: message.userId,
      roomId: message.roomId,
      userState: {},
      agentState: {},
      recentMessages: [message],
    };
  }
}

/**
 * Main function to run ElizaOS agent on POD-COM
 */
async function runElizaAgentOnPodCom() {
  console.log('🚀 Integrating ElizaOS Agent with POD-COM Network\n');
  
  try {
    // 1. Setup Solana configuration
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const walletKeypair = Keypair.generate(); // In reality, load from file
    const programId = 'PodC1111111111111111111111111111111111111111'; // Replace with actual
    
    console.log(`🔑 Wallet: ${walletKeypair.publicKey.toString()}`);
    console.log(`🆔 Program ID: ${programId}\n`);
    
    // 2. Create ElizaOS runtime
    const elizaRuntime = new MockElizaRuntime(exampleElizaAgent.id);
    
    // 3. Setup ElizaOS agent on POD-COM using the utility function
    const adapter = await setupElizaOnPodCom({
      // Solana config
      rpcUrl: 'https://api.devnet.solana.com',
      walletKeypair,
      programId,
      
      // ElizaOS config
      elizaAgent: exampleElizaAgent,
      elizaRuntime,
      
      // POD-COM settings
      feePerMessage: 1500, // 1500 lamports for premium trading signals
      capabilities: ['trading', 'analysis', 'signals', 'advice'],
      endpointUrl: 'https://my-trading-bot.com/webhook',
      
      // Auto-join demo channels (replace with actual channel IDs)
      autoJoinChannels: [
        // 'CHANNEL_ID_1',
        // 'CHANNEL_ID_2',
      ],
    });
    
    console.log('✅ ElizaOS agent successfully integrated with POD-COM!\n');
    
    // 4. Demonstrate agent capabilities
    await demonstrateCapabilities(adapter);
    
    // 5. Monitor agent statistics
    setInterval(async () => {
      const stats = await adapter.getStats();
      console.log('\n📊 Agent Statistics:');
      console.log(`   ElizaOS Actions: ${stats.elizaAgent.actionsCount}`);
      console.log(`   ElizaOS Plugins: ${stats.elizaAgent.pluginsCount}`);
      console.log(`   POD-COM Messages Sent: ${stats.podComAgent?.messagesSent || 0}`);
      console.log(`   POD-COM Reputation: ${stats.reputation?.overallScore || 5000}/10000`);
      console.log(`   Active Channels: ${stats.activeChannels.length}`);
    }, 60000); // Every minute
    
    // Keep the process running
    console.log('\n🔄 ElizaOS agent is running on POD-COM! Press Ctrl+C to stop.\n');
    
    // Simulate incoming messages for demonstration
    await simulateIncomingMessages(adapter);
    
  } catch (error) {
    console.error('💥 Failed to integrate ElizaOS agent with POD-COM:', error);
    console.log('\n💡 Make sure you have:');
    console.log('   1. Deployed the POD-COM program');
    console.log('   2. Updated the program ID');
    console.log('   3. Have SOL in your wallet');
    console.log('   4. Proper ElizaOS dependencies');
  }
}

/**
 * Demonstrate the integrated agent's capabilities
 */
async function demonstrateCapabilities(adapter: any) {
  console.log('🎯 Demonstrating ElizaOS + POD-COM Integration:\n');
  
  const stats = await adapter.getStats();
  
  console.log(`📋 Agent Overview:`);
  console.log(`   Name: ${stats.elizaAgent.name}`);
  console.log(`   Actions Available: ${stats.elizaAgent.actionsCount}`);
  console.log(`   Plugins Loaded: ${stats.elizaAgent.pluginsCount}`);
  console.log(`   POD-COM Capabilities: trading, analysis, signals, advice`);
  console.log('');
  
  console.log('💬 Sample Interactions:');
  console.log('   "analyze market" → Market analysis with current prices');
  console.log('   "trading signal" → AI-generated trading recommendations');
  console.log('   "portfolio advice" → Investment diversification tips');
  console.log('   "help" → Available commands and capabilities');
  console.log('   "status" → Agent status and network information');
  console.log('');
}

/**
 * Simulate incoming messages to demonstrate the agent
 */
async function simulateIncomingMessages(adapter: any) {
  const sampleMessages = [
    'analyze market',
    'give me a trading signal for SOL',
    'what portfolio advice do you have?',
    'help',
    'status',
    'what is the current price of bitcoin?',
  ];
  
  let messageIndex = 0;
  
  // Simulate a message every 30 seconds
  setInterval(() => {
    const message = sampleMessages[messageIndex % sampleMessages.length];
    console.log(`📨 Simulated message: "${message}"`);
    console.log(`💭 ElizaOS agent would process this and respond via POD-COM`);
    
    messageIndex++;
  }, 30000);
}

/**
 * Advanced Example: Building a Custom ElizaOS Agent for POD-COM
 */
async function buildCustomElizaAgentForPodCom() {
  console.log('🛠️ Building Custom ElizaOS Agent for POD-COM\n');
  
  // Use the builder to create a POD-COM optimized agent
  const agentBuilder = new ElizaPodComAgentBuilder();
  
  const customAgent = agentBuilder
    .setBasicInfo(
      'pod-com-specialist',
      'POD-COM Specialist',
      'AI agent specialized in blockchain communication and POD-COM network operations'
    )
    .addPodComAction({
      name: 'channel_analytics',
      description: 'Analyze channel activity and provide insights',
      podComMessageTypes: ['dataStream', 'functionCall'],
      async handler(runtime, message) {
        return {
          text: `📊 Channel Analytics\n\nChannel Activity: High\nMessage Volume: 150+ messages/day\nActive Participants: 12\nAverage Response Time: 2.3 minutes\n\nInsights: Peak activity during US market hours. Most discussions focus on trading strategies.`,
          metadata: {
            messageVolume: 150,
            activeParticipants: 12,
            avgResponseTime: 2.3,
            peakHours: 'US market hours',
          },
        };
      },
    })
    .addPodComAction({
      name: 'network_status',
      description: 'Get POD-COM network status and statistics',
      podComMessageTypes: ['functionCall'],
      async handler(runtime, message) {
        return {
          text: `🌐 POD-COM Network Status\n\nNetwork: Online ✅\nTotal Agents: 2,847\nActive Channels: 574\nMessages/24h: 12,450\nAverage TPS: 2.4\n\nNetwork health is excellent!`,
          metadata: {
            networkStatus: 'online',
            totalAgents: 2847,
            activeChannels: 574,
            messages24h: 12450,
            averageTPS: 2.4,
          },
        };
      },
    })
    .addPodComEvaluator({
      name: 'pod_com_context',
      description: 'Evaluate if message is POD-COM related',
      async evaluate(runtime, message) {
        const podComKeywords = ['podcom', 'pod-com', 'channel', 'agent', 'reputation', 'escrow', 'solana'];
        const text = message.content.text.toLowerCase();
        return podComKeywords.some(keyword => text.includes(keyword));
      },
    })
    .build();
  
  console.log('✅ Custom POD-COM agent built successfully!');
  console.log(`   Agent: ${customAgent.name}`);
  console.log(`   Actions: ${customAgent.actions.length}`);
  console.log(`   Evaluators: ${customAgent.evaluators.length}`);
  
  return customAgent;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down ElizaOS + POD-COM integration...');
  process.exit(0);
});

// Export functions for use as module
export { 
  runElizaAgentOnPodCom, 
  buildCustomElizaAgentForPodCom,
  exampleElizaAgent,
  MockElizaRuntime
};

// Run if called directly
if (require.main === module) {
  runElizaAgentOnPodCom();
}
