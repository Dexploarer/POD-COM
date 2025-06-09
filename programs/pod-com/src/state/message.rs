use anchor_lang::prelude::*;
use crate::state::*;

/// Message account
/// 
/// Represents a single message sent through a channel.
/// Content is stored as a hash for privacy, with actual content
/// stored off-chain or encrypted.
#[account]
pub struct Message {
    /// Unique identifier for the message
    pub message_id: Pubkey,
    
    /// Channel this message belongs to
    pub channel_id: Pubkey,
    
    /// Agent who sent the message
    pub sender: Pubkey,
    
    /// Intended recipient (None for broadcast messages)
    pub recipient: Option<Pubkey>,
    
    /// Type of message content
    pub message_type: MessageType,
    
    /// Hash of the message content (for verification/privacy)
    pub content_hash: [u8; 32],
    
    /// Additional metadata (JSON string)
    pub metadata: String,
    
    /// Fee paid for this message in lamports
    pub fee_paid: u64,
    
    /// Unix timestamp when message was sent
    pub timestamp: i64,
    
    /// Whether this message has been acknowledged by recipient
    pub acknowledged: bool,
    
    /// Response to this message (if any)
    pub response_to: Option<Pubkey>,
    
    /// Reserved space for future upgrades
    pub _reserved: [u8; 64],
}

impl Message {
    /// Calculate the space needed for a Message account
    pub fn space(metadata: &str) -> usize {
        8 + // discriminator
        32 + // message_id
        32 + // channel_id
        32 + // sender
        1 + 32 + // recipient (Option<Pubkey>)
        1 + // message_type (enum, assuming 1 byte)
        32 + // content_hash
        4 + metadata.len() + // metadata (String)
        8 + // fee_paid
        8 + // timestamp
        1 + // acknowledged
        1 + 32 + // response_to (Option<Pubkey>)
        64 // _reserved
    }
    
    /// Create a new message
    pub fn new(
        message_id: Pubkey,
        channel_id: Pubkey,
        sender: Pubkey,
        recipient: Option<Pubkey>,
        message_type: MessageType,
        content_hash: [u8; 32],
        metadata: String,
        fee_paid: u64,
    ) -> Self {
        Self {
            message_id,
            channel_id,
            sender,
            recipient,
            message_type,
            content_hash,
            metadata,
            fee_paid,
            timestamp: Clock::get().unwrap().unix_timestamp,
            acknowledged: false,
            response_to: None,
            _reserved: [0; 64],
        }
    }
    
    /// Check if metadata is valid length
    pub fn validate_metadata(metadata: &str) -> bool {
        metadata.len() <= MAX_METADATA_LENGTH
    }
    
    /// Mark message as acknowledged
    pub fn acknowledge(&mut self) {
        self.acknowledged = true;
    }
    
    /// Set this message as a response to another message
    pub fn set_response_to(&mut self, parent_message: Pubkey) {
        self.response_to = Some(parent_message);
    }
    
    /// Check if this is a broadcast message
    pub fn is_broadcast(&self) -> bool {
        self.recipient.is_none()
    }
    
    /// Check if this is a direct message
    pub fn is_direct_message(&self) -> bool {
        self.recipient.is_some()
    }
    
    /// Get the age of this message in seconds
    pub fn age_seconds(&self) -> i64 {
        Clock::get().unwrap().unix_timestamp - self.timestamp
    }
}

/// Message statistics for analytics
#[account]
pub struct MessageStats {
    /// Channel these stats belong to
    pub channel_id: Pubkey,
    
    /// Total messages in channel
    pub total_messages: u64,
    
    /// Messages by type
    pub plain_text_count: u64,
    pub function_call_count: u64,
    pub data_stream_count: u64,
    pub workflow_count: u64,
    pub ai_prompt_count: u64,
    pub media_count: u64,
    pub code_count: u64,
    
    /// Total fees collected
    pub total_fees: u64,
    
    /// Average message fee
    pub avg_fee: u64,
    
    /// Last updated timestamp
    pub last_updated: i64,
    
    /// Reserved space for future upgrades
    pub _reserved: [u8; 128],
}

impl MessageStats {
    pub const LEN: usize = 8 + 32 + 8 * 10 + 128;
    
    /// Update stats with a new message
    pub fn record_message(&mut self, message_type: &MessageType, fee: u64) {
        self.total_messages += 1;
        
        match message_type {
            MessageType::PlainText => self.plain_text_count += 1,
            MessageType::FunctionCall => self.function_call_count += 1,
            MessageType::DataStream => self.data_stream_count += 1,
            MessageType::Workflow => self.workflow_count += 1,
            MessageType::AIPrompt => self.ai_prompt_count += 1,
            MessageType::Media => self.media_count += 1,
            MessageType::Code => self.code_count += 1,
        }
        
        self.total_fees += fee;
        self.avg_fee = self.total_fees / self.total_messages;
        self.last_updated = Clock::get().unwrap().unix_timestamp;
    }
}
