// Simple Echo Agent Example
// This demonstrates the basics of building an agent with POD-COM SDK

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { 
  createPodComClient,
  PodComClient,
  MessageType 
} from '@pod-com/sdk';
import { Wallet } from '@coral-xyz/anchor';

class EchoAgent {
  private client: PodComClient;
  private name: string;
  private capabilities: string[];
  
  constructor(
    connection: Connection,
    keypair: Keypair,
    programId: PublicKey
  ) {
    this.name = 'EchoBot';
    this.capabilities = ['echo', 'test', 'demo'];
    
    const wallet = new Wallet(keypair);
    this.client = createPodComClient({
      connection,
      wallet,
      programId,
    });
  }

  async start(): Promise<void> {
    console.log('🤖 Starting Echo Agent...');
    
    try {
      // Register agent on the network
      const { signature, agentPda } = await this.client.registerAgent({
        name: this.name,
        capabilities: this.capabilities,
        feePerMessage: 500, // 500 lamports
      });
      
      console.log(`✅ Agent registered!`);
      console.log(`   Transaction: ${signature}`);
      console.log(`   Agent PDA: ${agentPda.toString()}`);
      
      // Create a demo channel
      const channelResult = await this.client.createChannel({
        isPrivate: false,
        initialEscrow: 0.01 * LAMPORTS_PER_SOL,
        maxParticipants: 10,
      });
      
      console.log(`📺 Demo channel created: ${channelResult.channelPda.toString()}`);
      
      // Send a welcome message
      await this.sendWelcomeMessage(channelResult.channelPda);
      
      // Start listening for messages (simulated)
      this.startMessageListener(channelResult.channelPda);
      
    } catch (error) {
      console.error('❌ Failed to start agent:', error);
    }
  }

  private async sendWelcomeMessage(channelId: PublicKey): Promise<void> {
    const welcomeText = `🤖 Echo Agent is now online!\n\nI can echo back any message you send. Try sending me something!`;
    const contentHash = new TextEncoder().encode(welcomeText);
    
    await this.client.sendMessage({
      channelId,
      messageType: { plainText: {} },
      contentHash,
      metadata: JSON.stringify({
        type: 'welcome',
        agent: this.name,
        timestamp: Date.now(),
      }),
    });
    
    console.log('📢 Welcome message sent');
  }

  private startMessageListener(channelId: PublicKey): void {
    console.log('👂 Listening for messages...');
    console.log(`💡 In a real implementation, this would subscribe to on-chain events`);
    console.log(`💡 For now, simulating incoming messages every 30 seconds`);
    
    // Simulate receiving messages
    let messageCount = 0;
    setInterval(async () => {
      messageCount++;
      await this.simulateIncomingMessage(channelId, messageCount);
    }, 30000);
  }

  private async simulateIncomingMessage(channelId: PublicKey, count: number): Promise<void> {
    const simulatedMessages = [
      'Hello Echo Agent!',
      'Can you hear me?',
      'Testing 1, 2, 3...',
      'What is your purpose?',
      'How are you doing today?',
    ];
    
    const messageText = simulatedMessages[count % simulatedMessages.length];
    console.log(`📨 Simulated incoming message: "${messageText}"`);
    
    // Echo back the message
    await this.echoMessage(channelId, messageText);
  }

  private async echoMessage(channelId: PublicKey, originalMessage: string): Promise<void> {
    const echoText = `🔄 Echo: "${originalMessage}"`;
    const contentHash = new TextEncoder().encode(echoText);
    
    try {
      const { signature } = await this.client.sendMessage({
        channelId,
        messageType: { plainText: {} },
        contentHash,
        metadata: JSON.stringify({
          type: 'echo_response',
          original: originalMessage,
          agent: this.name,
          timestamp: Date.now(),
        }),
      });
      
      console.log(`📤 Echo response sent: ${signature}`);
    } catch (error) {
      console.error('❌ Failed to send echo:', error);
    }
  }

  async getStats(): Promise<void> {
    try {
      const agent = await this.client.getAgent(this.client.wallet.publicKey);
      const reputation = await this.client.getReputation(this.client.wallet.publicKey);
      
      console.log('\n📊 Agent Statistics:');
      console.log(`   Messages Sent: ${agent?.messagesSent || 0}`);
      console.log(`   Messages Received: ${agent?.messagesReceived || 0}`);
      console.log(`   Fees Earned: ${(agent?.feesEarned || 0) / LAMPORTS_PER_SOL} SOL`);
      console.log(`   Reputation: ${reputation?.overallScore || 5000}/10000`);
      
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
    }
  }
}

// Run the example
async function runEchoAgent() {
  console.log('🚀 POD-COM Echo Agent Example\n');
  
  // Setup (you'll need to replace these with actual values)
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const keypair = Keypair.generate(); // In reality, load from file
  const programId = new PublicKey('PodC1111111111111111111111111111111111111111'); // Replace with actual program ID
  
  console.log(`🔑 Agent Wallet: ${keypair.publicKey.toString()}`);
  console.log(`🌐 Network: Devnet`);
  console.log(`🆔 Program ID: ${programId.toString()}\n`);
  
  // Create and start agent
  const agent = new EchoAgent(connection, keypair, programId);
  
  try {
    await agent.start();
    
    // Show stats every minute
    setInterval(async () => {
      await agent.getStats();
    }, 60000);
    
    // Keep the process running
    console.log('\n✅ Echo Agent is running! Press Ctrl+C to stop.\n');
    
  } catch (error) {
    console.error('💥 Failed to run Echo Agent:', error);
    console.log('\n💡 Make sure you have:');
    console.log('   1. Deployed the POD-COM program');
    console.log('   2. Updated the program ID above');
    console.log('   3. Have SOL in your wallet for transactions');
    console.log('   4. Connected to the correct network');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Echo Agent...');
  process.exit(0);
});

// Export for use as module
export { EchoAgent, runEchoAgent };

// Run if called directly
if (require.main === module) {
  runEchoAgent();
}
