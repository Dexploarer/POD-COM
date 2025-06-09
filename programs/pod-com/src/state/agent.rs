use anchor_lang::prelude::*;
use crate::state::*;

/// Agent registry account
/// 
/// Stores information about registered AI agents including their
/// capabilities, contact information, and reputation metrics.
#[account]
pub struct Agent {
    /// Unique identifier for the agent (typically the owner's pubkey)
    pub agent_id: Pubkey,
    
    /// Human-readable name for the agent
    pub name: String,
    
    /// List of agent capabilities (e.g., ["trading", "analysis", "code"])
    pub capabilities: Vec<String>,
    
    /// Optional webhook endpoint for real-time notifications
    pub endpoint_url: Option<String>,
    
    /// Fee charged per message in lamports
    pub fee_per_message: u64,
    
    /// Owner of this agent (can update settings)
    pub owner: Pubkey,
    
    /// Unix timestamp when agent was registered
    pub created_at: i64,
    
    /// Unix timestamp of last activity
    pub last_active: i64,
    
    /// Whether the agent is currently active
    pub is_active: bool,
    
    /// Total number of messages sent by this agent
    pub messages_sent: u64,
    
    /// Total number of messages received by this agent
    pub messages_received: u64,
    
    /// Total fees earned (in lamports)
    pub fees_earned: u64,
    
    /// Total fees spent (in lamports)
    pub fees_spent: u64,
    
    /// Current reputation score (weighted average)
    pub reputation_score: u32,
    
    /// Number of reputation reviews received
    pub review_count: u32,
    
    /// Reserved space for future upgrades
    pub _reserved: [u8; 128],
}

impl Agent {
    /// Calculate the space needed for an Agent account
    pub fn space(name: &str, capabilities: &[String], endpoint_url: &Option<String>) -> usize {
        8 + // discriminator
        32 + // agent_id
        4 + name.len() + // name (String)
        4 + capabilities.iter().map(|c| 4 + c.len()).sum::<usize>() + // capabilities (Vec<String>)
        1 + endpoint_url.as_ref().map_or(0, |url| 4 + url.len()) + // endpoint_url (Option<String>)
        8 + // fee_per_message
        32 + // owner
        8 + // created_at
        8 + // last_active
        1 + // is_active
        8 + // messages_sent
        8 + // messages_received
        8 + // fees_earned
        8 + // fees_spent
        4 + // reputation_score
        4 + // review_count
        128 // _reserved
    }
    
    /// Update the agent's last active timestamp
    pub fn update_activity(&mut self) {
        self.last_active = Clock::get().unwrap().unix_timestamp;
    }
    
    /// Check if agent name is valid
    pub fn validate_name(name: &str) -> bool {
        !name.is_empty() && name.len() <= MAX_NAME_LENGTH
    }
    
    /// Check if capabilities are valid
    pub fn validate_capabilities(capabilities: &[String]) -> bool {
        capabilities.len() <= MAX_CAPABILITIES &&
        capabilities.iter().all(|cap| 
            !cap.is_empty() && cap.len() <= MAX_CAPABILITY_LENGTH
        )
    }
    
    /// Check if endpoint URL is valid
    pub fn validate_endpoint_url(url: &Option<String>) -> bool {
        match url {
            Some(url_str) => url_str.len() <= MAX_ENDPOINT_URL_LENGTH && url_str.starts_with("http"),
            None => true,
        }
    }
}
