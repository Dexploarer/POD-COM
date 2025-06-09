use anchor_lang::prelude::*;
use crate::state::*;

/// Communication channel account
/// 
/// Represents a communication channel between multiple agents
/// with shared escrow and message history.
#[account]
pub struct Channel {
    /// Unique identifier for the channel
    pub channel_id: Pubkey,
    
    /// Creator of the channel
    pub creator: Pubkey,
    
    /// List of agent pubkeys that can participate
    pub participants: Vec<Pubkey>,
    
    /// Whether this is a private (encrypted) channel
    pub is_private: bool,
    
    /// Maximum number of participants allowed
    pub max_participants: u8,
    
    /// Escrow account holding fees for this channel
    pub escrow_account: Pubkey,
    
    /// Current escrow balance in lamports
    pub escrow_balance: u64,
    
    /// Fee per message for this channel (can override agent fees)
    pub fee_per_message: Option<u64>,
    
    /// Total number of messages sent in this channel
    pub message_count: u64,
    
    /// Unix timestamp when channel was created
    pub created_at: i64,
    
    /// Unix timestamp of last message
    pub last_message_at: i64,
    
    /// Whether the channel is currently active
    pub is_active: bool,
    
    /// Channel metadata (JSON string)
    pub metadata: String,
    
    /// Reserved space for future upgrades
    pub _reserved: [u8; 128],
}

impl Channel {
    /// Calculate the space needed for a Channel account
    pub fn space(participants: &[Pubkey], metadata: &str) -> usize {
        8 + // discriminator
        32 + // channel_id
        32 + // creator
        4 + (participants.len() * 32) + // participants (Vec<Pubkey>)
        1 + // is_private
        1 + // max_participants
        32 + // escrow_account
        8 + // escrow_balance
        1 + 8 + // fee_per_message (Option<u64>)
        8 + // message_count
        8 + // created_at
        8 + // last_message_at
        1 + // is_active
        4 + metadata.len() + // metadata (String)
        128 // _reserved
    }
    
    /// Check if an agent is authorized to use this channel
    pub fn is_participant(&self, agent: &Pubkey) -> bool {
        self.participants.contains(agent) || *agent == self.creator
    }
    
    /// Add a participant to the channel
    pub fn add_participant(&mut self, agent: Pubkey) -> Result<()> {
        require!(
            self.participants.len() < self.max_participants as usize,
            crate::errors::PodComError::ChannelAtCapacity
        );
        
        if !self.is_participant(&agent) {
            self.participants.push(agent);
        }
        
        Ok(())
    }
    
    /// Remove a participant from the channel
    pub fn remove_participant(&mut self, agent: &Pubkey) -> bool {
        if let Some(pos) = self.participants.iter().position(|p| p == agent) {
            self.participants.remove(pos);
            true
        } else {
            false
        }
    }
    
    /// Update message statistics
    pub fn record_message(&mut self) {
        self.message_count += 1;
        self.last_message_at = Clock::get().unwrap().unix_timestamp;
    }
    
    /// Get effective fee per message for this channel
    pub fn get_effective_fee(&self, agent_fee: u64) -> u64 {
        self.fee_per_message.unwrap_or(agent_fee)
    }
    
    /// Check if channel has sufficient escrow for a message
    pub fn can_afford_message(&self, fee: u64) -> bool {
        self.escrow_balance >= fee
    }
    
    /// Deduct fee from escrow
    pub fn deduct_fee(&mut self, fee: u64) -> Result<()> {
        require!(
            self.escrow_balance >= fee,
            crate::errors::PodComError::InsufficientEscrow
        );
        
        self.escrow_balance = self.escrow_balance
            .checked_sub(fee)
            .ok_or(crate::errors::PodComError::ArithmeticOverflow)?;
        
        Ok(())
    }
}
