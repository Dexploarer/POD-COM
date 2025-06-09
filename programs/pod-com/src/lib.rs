use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;
use state::*;
use errors::*;

declare_id!("PodC1111111111111111111111111111111111111111");

/// POD-COM: Solana-based AI Agent Communication Protocol
/// 
/// This program implements a decentralized messaging system specifically designed
/// for AI agents to discover, communicate, and transact with each other.
#[program]
pub mod pod_com {
    use super::*;

    /// Initialize a new agent in the registry
    /// 
    /// # Arguments
    /// * `name` - Human-readable name for the agent
    /// * `capabilities` - List of capabilities (e.g., ["trading", "analysis"])
    /// * `endpoint_url` - Optional webhook endpoint for the agent
    /// * `fee_per_message` - Fee in lamports per message
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        capabilities: Vec<String>,
        endpoint_url: Option<String>,
        fee_per_message: u64,
    ) -> Result<()> {
        instructions::register_agent::handler(
            ctx,
            name,
            capabilities,
            endpoint_url,
            fee_per_message,
        )
    }

    /// Create a new communication channel between agents
    /// 
    /// # Arguments
    /// * `is_private` - Whether the channel should be encrypted
    /// * `initial_escrow` - Initial SOL to deposit for fees
    /// * `max_participants` - Maximum number of agents in channel
    pub fn create_channel(
        ctx: Context<CreateChannel>,
        is_private: bool,
        initial_escrow: u64,
        max_participants: u8,
    ) -> Result<()> {
        instructions::create_channel::handler(
            ctx,
            is_private,
            initial_escrow,
            max_participants,
        )
    }

    /// Send a message through a channel
    /// 
    /// # Arguments
    /// * `message_type` - Type of message (text, function_call, etc.)
    /// * `content_hash` - Hash of the message content (for privacy)
    /// * `metadata` - Additional message metadata
    pub fn send_message(
        ctx: Context<SendMessage>,
        message_type: MessageType,
        content_hash: [u8; 32],
        metadata: String,
    ) -> Result<()> {
        instructions::send_message::handler(
            ctx,
            message_type,
            content_hash,
            metadata,
        )
    }

    /// Update agent reputation based on peer reviews
    /// 
    /// # Arguments
    /// * `target_agent` - Agent being reviewed
    /// * `rating` - Rating from 1-100
    /// * `review_type` - Type of review (response_time, accuracy, etc.)
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        rating: u8,
        review_type: ReputationType,
    ) -> Result<()> {
        instructions::update_reputation::handler(ctx, rating, review_type)
    }

    /// Manage escrow funds for a channel
    /// 
    /// # Arguments
    /// * `action` - Deposit, withdraw, or redistribute funds
    /// * `amount` - Amount in lamports
    pub fn manage_escrow(
        ctx: Context<ManageEscrow>,
        action: EscrowAction,
        amount: u64,
    ) -> Result<()> {
        instructions::manage_escrow::handler(ctx, action, amount)
    }
}
