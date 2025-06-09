import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { PodCom } from "../target/types/pod_com";

describe("POD-COM Tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PodCom as Program<PodCom>;
  
  // Test keypairs
  let agentKeypair: Keypair;
  let channelCreator: Keypair;
  let secondAgent: Keypair;
  
  // PDAs
  let agentPda: PublicKey;
  let reputationPda: PublicKey;
  let channelPda: PublicKey;
  let escrowPda: PublicKey;
  let statsPda: PublicKey;

  before(async () => {
    // Generate test keypairs
    agentKeypair = Keypair.generate();
    channelCreator = Keypair.generate();
    secondAgent = Keypair.generate();
    
    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(agentKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(channelCreator.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(secondAgent.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe("Agent Registration", () => {
    it("Should register a new agent", async () => {
      // Derive PDAs
      [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agentKeypair.publicKey.toBuffer()],
        program.programId
      );
      
      [reputationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation"), agentKeypair.publicKey.toBuffer()],
        program.programId
      );

      const name = "TestAgent";
      const capabilities = ["trading", "analysis"];
      const endpointUrl = "https://api.testagent.com/webhook";
      const feePerMessage = new anchor.BN(1000); // 1000 lamports

      const tx = await program.methods
        .registerAgent(name, capabilities, endpointUrl, feePerMessage)
        .accounts({
          agent: agentPda,
          reputation: reputationPda,
          owner: agentKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([agentKeypair])
        .rpc();

      console.log("Agent registration tx:", tx);

      // Verify agent account
      const agentAccount = await program.account.agent.fetch(agentPda);
      expect(agentAccount.name).to.equal(name);
      expect(agentAccount.capabilities).to.deep.equal(capabilities);
      expect(agentAccount.endpointUrl).to.equal(endpointUrl);
      expect(agentAccount.feePerMessage.toString()).to.equal(feePerMessage.toString());
      expect(agentAccount.isActive).to.be.true;
      expect(agentAccount.messagesSent.toString()).to.equal("0");
      expect(agentAccount.messagesReceived.toString()).to.equal("0");

      // Verify reputation account
      const reputationAccount = await program.account.reputation.fetch(reputationPda);
      expect(reputationAccount.agentId.toString()).to.equal(agentKeypair.publicKey.toString());
      expect(reputationAccount.overallScore).to.equal(5000); // 50%
      expect(reputationAccount.totalReviews).to.equal(0);
    });

    it("Should fail to register agent with invalid name", async () => {
      const invalidName = "a".repeat(65); // Too long
      const capabilities = ["trading"];
      const feePerMessage = new anchor.BN(1000);

      try {
        await program.methods
          .registerAgent(invalidName, capabilities, null, feePerMessage)
          .accounts({
            agent: agentPda,
            reputation: null,
            owner: agentKeypair.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([agentKeypair])
          .rpc();
        
        expect.fail("Should have failed with invalid name");
      } catch (error) {
        expect(error.message).to.include("AgentNameTooLong");
      }
    });
  });

  describe("Channel Creation", () => {
    it("Should create a new channel", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Derive channel PDA with timestamp
      [channelPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("channel"),
          channelCreator.publicKey.toBuffer(),
          Buffer.from(currentTime.toString())
        ],
        program.programId
      );
      
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), channelPda.toBuffer()],
        program.programId
      );
      
      [statsPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stats"), channelPda.toBuffer()],
        program.programId
      );

      const isPrivate = false;
      const initialEscrow = new anchor.BN(10_000_000); // 0.01 SOL
      const maxParticipants = 10;

      const tx = await program.methods
        .createChannel(isPrivate, initialEscrow, maxParticipants)
        .accounts({
          channel: channelPda,
          escrowAccount: escrowPda,
          messageStats: statsPda,
          creator: channelCreator.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([channelCreator])
        .rpc();

      console.log("Channel creation tx:", tx);

      // Verify channel account
      const channelAccount = await program.account.channel.fetch(channelPda);
      expect(channelAccount.creator.toString()).to.equal(channelCreator.publicKey.toString());
      expect(channelAccount.isPrivate).to.equal(isPrivate);
      expect(channelAccount.maxParticipants).to.equal(maxParticipants);
      expect(channelAccount.participants).to.have.length(1);
      expect(channelAccount.participants[0].toString()).to.equal(channelCreator.publicKey.toString());
      expect(channelAccount.isActive).to.be.true;
      expect(channelAccount.messageCount.toString()).to.equal("0");

      // Verify escrow balance
      const escrowBalance = await provider.connection.getBalance(escrowPda);
      expect(escrowBalance).to.be.greaterThan(0);
    });
  });

  describe("Message Sending", () => {
    let messagePda: PublicKey;

    it("Should send a message to a channel", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      
      [messagePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("message"),
          channelPda.toBuffer(),
          agentPda.toBuffer(),
          Buffer.from(currentTime.toString())
        ],
        program.programId
      );

      const messageType = { plainText: {} };
      const contentHash = Array.from(Buffer.alloc(32, 1)); // Dummy hash
      const metadata = JSON.stringify({ type: "greeting", urgency: "low" });

      const tx = await program.methods
        .sendMessage(messageType, contentHash, metadata)
        .accounts({
          message: messagePda,
          channel: channelPda,
          escrowAccount: escrowPda,
          senderAgent: agentPda,
          recipientAgent: null,
          messageStats: statsPda,
          sender: agentKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([agentKeypair])
        .rpc();

      console.log("Message send tx:", tx);

      // Verify message account
      const messageAccount = await program.account.message.fetch(messagePda);
      expect(messageAccount.channelId.toString()).to.equal(channelPda.toString());
      expect(messageAccount.sender.toString()).to.equal(agentKeypair.publicKey.toString());
      expect(messageAccount.contentHash).to.deep.equal(contentHash);
      expect(messageAccount.metadata).to.equal(metadata);
      expect(messageAccount.acknowledged).to.be.false;

      // Verify channel message count updated
      const channelAccount = await program.account.channel.fetch(channelPda);
      expect(channelAccount.messageCount.toString()).to.equal("1");

      // Verify agent stats updated
      const agentAccount = await program.account.agent.fetch(agentPda);
      expect(agentAccount.messagesSent.toString()).to.equal("1");
    });
  });

  describe("Reputation Management", () => {
    let secondAgentPda: PublicKey;
    let secondReputationPda: PublicKey;

    before(async () => {
      // Register second agent for reputation testing
      [secondAgentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), secondAgent.publicKey.toBuffer()],
        program.programId
      );
      
      [secondReputationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation"), secondAgent.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerAgent("SecondAgent", ["testing"], null, new anchor.BN(500))
        .accounts({
          agent: secondAgentPda,
          reputation: secondReputationPda,
          owner: secondAgent.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([secondAgent])
        .rpc();
    });

    it("Should update agent reputation", async () => {
      const rating = 85;
      const reviewType = { accuracy: {} };

      const tx = await program.methods
        .updateReputation(rating, reviewType)
        .accounts({
          reviewerAgent: agentPda,
          reviewerReputation: reputationPda,
          targetAgent: secondAgentPda,
          targetReputation: secondReputationPda,
          reviewer: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();

      console.log("Reputation update tx:", tx);

      // Verify reputation was updated
      const reputationAccount = await program.account.reputation.fetch(secondReputationPda);
      expect(reputationAccount.totalReviews).to.equal(1);
      expect(reputationAccount.accuracyScore).to.equal(rating);
      expect(reputationAccount.accuracyReviews).to.equal(1);

      // Verify agent reputation score was updated
      const agentAccount = await program.account.agent.fetch(secondAgentPda);
      expect(agentAccount.reviewCount).to.equal(1);
    });

    it("Should fail when agent tries to review themselves", async () => {
      const rating = 95;
      const reviewType = { helpfulness: {} };

      try {
        await program.methods
          .updateReputation(rating, reviewType)
          .accounts({
            reviewerAgent: agentPda,
            reviewerReputation: reputationPda,
            targetAgent: agentPda, // Same agent
            targetReputation: reputationPda,
            reviewer: agentKeypair.publicKey,
          })
          .signers([agentKeypair])
          .rpc();
        
        expect.fail("Should have failed with self-review error");
      } catch (error) {
        expect(error.message).to.include("SelfReview");
      }
    });
  });

  describe("Escrow Management", () => {
    it("Should deposit additional funds to escrow", async () => {
      const depositAmount = new anchor.BN(5_000_000); // 0.005 SOL
      const action = { deposit: {} };

      const initialBalance = await provider.connection.getBalance(escrowPda);

      const tx = await program.methods
        .manageEscrow(action, depositAmount)
        .accounts({
          channel: channelPda,
          escrowAccount: escrowPda,
          authority: channelCreator.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([channelCreator])
        .rpc();

      console.log("Escrow deposit tx:", tx);

      // Verify escrow balance increased
      const finalBalance = await provider.connection.getBalance(escrowPda);
      expect(finalBalance).to.be.greaterThan(initialBalance);

      // Verify channel escrow balance was updated
      const channelAccount = await program.account.channel.fetch(channelPda);
      expect(channelAccount.escrowBalance.toNumber()).to.be.greaterThan(0);
    });
  });
});
