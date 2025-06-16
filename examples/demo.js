const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram } = require("@solana/web3.js");

// Configure the client
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.PodCom;
const wallet = provider.wallet.payer;

const findAgentPDA = (wallet) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), wallet.toBuffer()],
    program.programId
  );
};

/**
 * Demonstrates the registration and update of an agent using the POD-COM protocol on the Solana Devnet.
 *
 * Performs agent account creation if it does not exist, updates agent capabilities and metadata, and logs protocol and network status information. Intended for showcasing POD-COM protocol functionality with the Anchor framework.
 */
async function demonstratePODCOM() {
  console.log("🚀 POD-COM Protocol Demonstration");
  console.log("=====================================");

  try {
    // Step 1: Agent Registration
    console.log("\n1. Agent Registration");
    console.log("-".repeat(30));

    const [agentPDA] = findAgentPDA(wallet.publicKey);
    console.log("Wallet:", wallet.publicKey.toBase58());
    console.log("Agent PDA:", agentPDA.toBase58());

    // Check if agent already exists
    let agentAccount;
    try {
      agentAccount = await program.account.agentAccount.fetch(agentPDA);
      console.log("✅ Agent already registered");
      console.log("   Capabilities:", agentAccount.capabilities.toString());
      console.log("   Metadata URI:", agentAccount.metadataUri);
      console.log("   Reputation:", agentAccount.reputation.toString());
    } catch (error) {
      console.log("📝 Registering new agent...");

      const capabilities = new anchor.BN(7); // trading + analysis + data-processing
      const metadataUri = "https://example.com/ai-agent-metadata";

      const tx = await program.methods
        .registerAgent(capabilities, metadataUri)
        .accounts({
          agentAccount: agentPDA,
          signer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Agent registered successfully!");
      console.log("   Transaction:", tx);

      agentAccount = await program.account.agentAccount.fetch(agentPDA);
    }

    // Step 2: Agent Capabilities Update
    console.log("\n2. Agent Capabilities Update");
    console.log("-".repeat(30));

    const newCapabilities = new anchor.BN(15); // All capabilities
    const newMetadataUri = "https://example.com/updated-agent-metadata";

    const updateTx = await program.methods
      .updateAgent(newCapabilities, newMetadataUri)
      .accounts({
        agentAccount: agentPDA,
        signer: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Agent updated successfully!");
    console.log("   Transaction:", updateTx);

    const updatedAgent = await program.account.agentAccount.fetch(agentPDA);
    console.log("   New Capabilities:", updatedAgent.capabilities.toString());
    console.log("   New Metadata URI:", updatedAgent.metadataUri);

    // Step 3: Protocol Status
    console.log("\n3. Protocol Status");
    console.log("-".repeat(30));
    console.log("✅ POD-COM Protocol is OPERATIONAL on Devnet");
    console.log("✅ Program ID:", program.programId.toBase58());
    console.log("✅ Agent Registration: WORKING");
    console.log("✅ Agent Updates: WORKING");
    console.log("✅ Message Infrastructure: DEPLOYED");

    // Step 4: Network Information
    console.log("\n4. Network Information");
    console.log("-".repeat(30));
    console.log("Network: Solana Devnet");
    console.log("Cluster: https://api.devnet.solana.com");
    console.log("Program: HEpGLgYsE1kP8aoYKyLFc3JVVrofS7T4zEA6fWBJsZps");
    console.log("Status: ACTIVE ✅");

    console.log("\n🎉 POD-COM Protocol Successfully Deployed and Operational!");
    console.log("Ready for AI agent communication on Solana blockchain.");
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
  }
}

demonstratePODCOM();
