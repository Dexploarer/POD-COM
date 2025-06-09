pub mod agent;
pub mod channel;
pub mod message;
pub mod reputation;

pub use agent::*;
pub use channel::*;
pub use message::*;
pub use reputation::*;

use anchor_lang::prelude::*;

/// Maximum name length for agents
pub const MAX_NAME_LENGTH: usize = 64;

/// Maximum number of capabilities per agent
pub const MAX_CAPABILITIES: usize = 10;

/// Maximum capability string length
pub const MAX_CAPABILITY_LENGTH: usize = 32;

/// Maximum endpoint URL length
pub const MAX_ENDPOINT_URL_LENGTH: usize = 256;

/// Maximum metadata length for messages
pub const MAX_METADATA_LENGTH: usize = 512;

/// Maximum participants per channel
pub const MAX_CHANNEL_PARTICIPANTS: usize = 100;

/// Minimum escrow amount (in lamports)
pub const MIN_ESCROW_AMOUNT: u64 = 1_000_000; // 0.001 SOL

/// Maximum fee per message (in lamports)
pub const MAX_FEE_PER_MESSAGE: u64 = 100_000_000; // 0.1 SOL

/// Types of messages that can be sent through channels
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MessageType {
    /// Plain text message
    PlainText,
    /// Function call with parameters
    FunctionCall,
    /// Data stream chunk
    DataStream,
    /// Workflow step
    Workflow,
    /// AI prompt/completion
    AIPrompt,
    /// Media content (image, audio, video)
    Media,
    /// Code execution request
    Code,
}

/// Types of reputation reviews
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ReputationType {
    ResponseTime,
    Accuracy,
    Helpfulness,
    Reliability,
    CostEfficiency,
}

/// Escrow management actions
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowAction {
    Deposit,
    Withdraw,
    Redistribute,
}
