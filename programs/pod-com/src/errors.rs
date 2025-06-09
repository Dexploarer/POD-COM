use anchor_lang::prelude::*;

#[error_code]
pub enum PodComError {
    #[msg("Agent name is too long (max 64 characters)")]
    AgentNameTooLong,
    
    #[msg("Invalid capabilities list")]
    InvalidCapabilities,
    
    #[msg("Fee per message is too high")]
    FeePerMessageTooHigh,
    
    #[msg("Channel is at maximum capacity")]
    ChannelAtCapacity,
    
    #[msg("Insufficient escrow balance")]
    InsufficientEscrow,
    
    #[msg("Agent not authorized for this channel")]
    AgentNotAuthorized,
    
    #[msg("Invalid message type")]
    InvalidMessageType,
    
    #[msg("Reputation rating must be between 1 and 100")]
    InvalidRating,
    
    #[msg("Cannot review yourself")]
    SelfReview,
    
    #[msg("Escrow amount is too small")]
    EscrowTooSmall,
    
    #[msg("Agent already exists")]
    AgentAlreadyExists,
    
    #[msg("Channel does not exist")]
    ChannelNotFound,
    
    #[msg("Message content hash is invalid")]
    InvalidContentHash,
    
    #[msg("Endpoint URL is malformed")]
    MalformedEndpointUrl,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
