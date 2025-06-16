const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

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
 * Logs detailed debugging information about the agent account and message PDA derivations for the connected wallet.
 *
 * Fetches and displays the wallet's public key, the derived agent PDA, and the agent account's data fields. Calculates and logs three variations of message PDAs using different seed combinations involving the wallet and agent account. Errors encountered during execution are caught and logged.
 */
async function debug() {
  try {
    console.log("Wallet pubkey:", wallet.publicKey.toBase58());

    const [agentPDA] = findAgentPDA(wallet.publicKey);
    console.log("Agent PDA:", agentPDA.toBase58());

    const agentAccount = await program.account.agentAccount.fetch(agentPDA);
    console.log("Agent account data:");
    console.log("- pubkey:", agentAccount.pubkey.toBase58());
    console.log("- capabilities:", agentAccount.capabilities.toString());
    console.log("- metadataUri:", agentAccount.metadataUri);
    console.log("- reputation:", agentAccount.reputation.toString());

    // Test message PDA calculation with different approaches
    const messageType = { text: {} };
    const payloadHash = new Uint8Array(32).fill(1);

    // Approach 1: Using wallet pubkey
    const [messagePDA1] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("message"),
        wallet.publicKey.toBuffer(),
        wallet.publicKey.toBuffer(),
        Buffer.from(payloadHash),
        Buffer.from([0]), // Text = 0
      ],
      program.programId
    );
    console.log("Message PDA (wallet pubkey):", messagePDA1.toBase58());

    // Approach 2: Using agent PDA
    const [messagePDA2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("message"),
        agentPDA.toBuffer(),
        wallet.publicKey.toBuffer(),
        Buffer.from(payloadHash),
        Buffer.from([0]), // Text = 0
      ],
      program.programId
    );
    console.log("Message PDA (agent PDA):", messagePDA2.toBase58());

    // Approach 3: Using agent.pubkey from the account
    const [messagePDA3] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("message"),
        agentAccount.pubkey.toBuffer(),
        wallet.publicKey.toBuffer(),
        Buffer.from(payloadHash),
        Buffer.from([0]), // Text = 0
      ],
      program.programId
    );
    console.log("Message PDA (agent.pubkey):", messagePDA3.toBase58());
  } catch (error) {
    console.error("Error:", error.message);
  }
}

debug();
