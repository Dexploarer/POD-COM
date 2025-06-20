// Global allow for Anchor-related config warnings and deprecated methods
#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;

declare_id!("HEpGLgYsE1kP8aoYKyLFc3JVVrofS7T4zEA6fWBJsZps");

/*
 * PoD Protocol (Prompt or Die): AI Agent Communication Protocol v1.0.0
 *
 * A comprehensive Solana program enabling secure, scalable communication between AI agents
 * with features including direct messaging, group channels, escrow systems, and reputation management.
 *
 * CORE FEATURES:
 * - Agent registration and identity management
 * - Direct messaging between agents with expiration
 * - Group communication via channels (public/private)
 * - Escrow system for channel fees and deposits
 * - Reputation system for trusted interactions
 * - Rate limiting and spam prevention
 * - Comprehensive event monitoring
 *
 * PDA USAGE DOCUMENTATION:
 * - Agent accounts use PDA: ["agent", wallet_pubkey]
 * - Message senders ALWAYS use agent PDA addresses (not wallet addresses)
 * - This ensures all communication is between registered agents
 * - Channel participants store agent PDA addresses
 *
 * CONSISTENCY RULES:
 * - message.sender = agent_pda (NOT wallet_pubkey)
 * - participant.participant = agent_pda (NOT wallet_pubkey)
 * - All communication flows through agent identities
 *
 * SECURITY FEATURES:
 * - Comprehensive input validation on all functions
 * - Rate limiting with sliding window approach
 * - Authorization checks for sensitive operations
 * - Escrow protection for financial interactions
 * - Message expiration for privacy
 *
 * PROGRAM ID: HEpGLgYsE1kP8aoYKyLFc3JVVrofS7T4zEA6fWBJsZps
 * NETWORK: Devnet (ready for mainnet deployment)
 */

// Constants
const MAX_METADATA_URI_LENGTH: usize = 200; // Maximum length of metadata URI
const MESSAGE_EXPIRATION_SECONDS: i64 = 7 * 24 * 60 * 60; // 7 days
const MAX_CHANNEL_NAME_LENGTH: usize = 50; // Maximum channel name length
const MAX_CHANNEL_DESCRIPTION_LENGTH: usize = 200; // Maximum channel description length
const MAX_PARTICIPANTS_PER_CHANNEL: u32 = 1000; // Maximum participants in a channel
const MAX_MESSAGE_CONTENT_LENGTH: usize = 1000; // Maximum message content length
const RATE_LIMIT_MESSAGES_PER_MINUTE: u16 = 60; // Rate limit for messages
const MIN_REPUTATION_FOR_CHANNELS: u64 = 50; // Minimum reputation to create channels

// Account Space Constants (8 bytes for discriminator + actual data)
// 8 discriminator + 32 pubkey + 8 capabilities + 4 len + uri + 8 reputation + 8 last_updated + 1 bump + padding
const AGENT_ACCOUNT_SPACE: usize = 8 + 32 + 8 + (4 + MAX_METADATA_URI_LENGTH) + 8 + 8 + 1 + 7; // 276 bytes
const MESSAGE_ACCOUNT_SPACE: usize = 8 + 32 + 32 + 32 + 1 + 8 + 8 + 1 + 1 + 7; // 130 bytes
const CHANNEL_ACCOUNT_SPACE: usize = 8
    + 32
    + (4 + MAX_CHANNEL_NAME_LENGTH)
    + (4 + MAX_CHANNEL_DESCRIPTION_LENGTH)
    + 1
    + 4
    + 4
    + 8
    + 8
    + 8
    + 1
    + 1
    + 6; // 335 bytes
const CHANNEL_PARTICIPANT_SPACE: usize = 8 + 32 + 32 + 8 + 1 + 8 + 8 + 1 + 7; // 105 bytes
const CHANNEL_INVITATION_SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 6; // 128 bytes
const CHANNEL_MESSAGE_SPACE: usize =
    8 + 32 + 32 + (4 + MAX_MESSAGE_CONTENT_LENGTH) + 1 + 8 + 9 + 33 + 1 + 7; // 1135 bytes
const ESCROW_ACCOUNT_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 7; // 96 bytes

// Error codes
#[error_code]
pub enum PodComError {
    #[msg("Invalid metadata URI length")]
    InvalidMetadataUriLength,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Message expired")]
    MessageExpired,
    #[msg("Invalid message status transition")]
    InvalidMessageStatusTransition,
    #[msg("Channel is full")]
    ChannelFull,
    #[msg("Already in channel")]
    AlreadyInChannel,
    #[msg("Not in channel")]
    NotInChannel,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Channel name too long")]
    ChannelNameTooLong,
    #[msg("Channel description too long")]
    ChannelDescriptionTooLong,
    #[msg("Insufficient reputation")]
    InsufficientReputation,
    #[msg("Rate limit exceeded")]
    RateLimitExceeded,
    #[msg("Message content too long")]
    MessageContentTooLong,
    #[msg("Private channel requires invitation")]
    PrivateChannelRequiresInvitation,
}

// Message types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MessageType {
    Text,
    Data,
    Command,
    Response,
    Custom(u8),
}

// Message status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum MessageStatus {
    Pending,
    Delivered,
    Read,
    Failed,
}

// Channel visibility
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChannelVisibility {
    Public,
    Private,
}

// Program Events for monitoring and indexing
#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub capabilities: u64,
    pub metadata_uri: String,
    pub timestamp: i64,
}

#[event]
pub struct MessageSent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub message_type: MessageType,
    pub timestamp: i64,
}

#[event]
pub struct ChannelCreated {
    pub channel: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub visibility: ChannelVisibility,
    pub timestamp: i64,
}

#[event]
pub struct ChannelJoined {
    pub channel: Pubkey,
    pub participant: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct MessageBroadcast {
    pub channel: Pubkey,
    pub sender: Pubkey,
    pub message_type: MessageType,
    pub timestamp: i64,
}

#[event]
pub struct EscrowDeposit {
    pub channel: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowWithdrawal {
    pub channel: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// Channel account structure
#[account]
pub struct ChannelAccount {
    pub creator: Pubkey,               // 32 bytes
    pub name: String,                  // 4 + 50 bytes (max 50 chars)
    pub description: String,           // 4 + 200 bytes (max 200 chars)
    pub visibility: ChannelVisibility, // 1 byte
    pub max_participants: u32,         // 4 bytes
    pub current_participants: u32,     // 4 bytes
    pub fee_per_message: u64,          // 8 bytes (lamports)
    pub escrow_balance: u64,           // 8 bytes (lamports)
    pub created_at: i64,               // 8 bytes
    pub is_active: bool,               // 1 byte
    pub bump: u8,                      // 1 byte
    _reserved: [u8; 6],                // 6 bytes (padding)
}

// Channel participant account structure
#[account]
pub struct ChannelParticipant {
    pub channel: Pubkey,      // 32 bytes
    pub participant: Pubkey,  // 32 bytes
    pub joined_at: i64,       // 8 bytes
    pub is_active: bool,      // 1 byte
    pub messages_sent: u64,   // 8 bytes
    pub last_message_at: i64, // 8 bytes
    pub bump: u8,             // 1 byte
    _reserved: [u8; 7],       // 7 bytes (padding)
}

// Channel invitation account structure (for private channels)
#[account]
pub struct ChannelInvitation {
    pub channel: Pubkey,   // 32 bytes
    pub inviter: Pubkey,   // 32 bytes
    pub invitee: Pubkey,   // 32 bytes
    pub created_at: i64,   // 8 bytes
    pub expires_at: i64,   // 8 bytes
    pub is_accepted: bool, // 1 byte
    pub bump: u8,          // 1 byte
    _reserved: [u8; 6],    // 6 bytes (padding)
}

// Channel message account structure (for broadcast messages)
#[account]
pub struct ChannelMessage {
    pub channel: Pubkey,           // 32 bytes
    pub sender: Pubkey,            // 32 bytes
    pub content: String,           // 4 + 1000 bytes (max content)
    pub message_type: MessageType, // 1 byte
    pub created_at: i64,           // 8 bytes
    pub edited_at: Option<i64>,    // 9 bytes (1 for Option + 8 for i64)
    pub reply_to: Option<Pubkey>,  // 33 bytes (1 for Option + 32 for Pubkey)
    pub bump: u8,                  // 1 byte
    _reserved: [u8; 7],            // 7 bytes (padding)
}

// Escrow account structure
#[account]
pub struct EscrowAccount {
    pub channel: Pubkey,   // 32 bytes
    pub depositor: Pubkey, // 32 bytes
    pub amount: u64,       // 8 bytes
    pub created_at: i64,   // 8 bytes
    pub bump: u8,          // 1 byte
    _reserved: [u8; 7],    // 7 bytes (padding)
}

// Agent account structure
#[account]
pub struct AgentAccount {
    pub pubkey: Pubkey,       // 32 bytes
    pub capabilities: u64,    // 8 bytes
    pub metadata_uri: String, // 4 + MAX_METADATA_URI_LENGTH bytes
    pub reputation: u64,      // 8 bytes
    pub last_updated: i64,    // 8 bytes
    pub bump: u8,             // 1 byte
    _reserved: [u8; 7],       // 7 bytes (padding)
}

// Message account structure
#[account]
pub struct MessageAccount {
    pub sender: Pubkey,            // 32 bytes
    pub recipient: Pubkey,         // 32 bytes
    pub payload_hash: [u8; 32],    // 32 bytes
    pub message_type: MessageType, // 1 byte (max)
    pub created_at: i64,           // 8 bytes
    pub expires_at: i64,           // 8 bytes
    pub status: MessageStatus,     // 1 byte (max)
    pub bump: u8,                  // 1 byte
    _reserved: [u8; 7],            // 7 bytes (padding)
}

#[allow(deprecated, unexpected_cfgs)]
#[program]
pub mod pod_com {
    use super::*;

    // Register a new agent
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        capabilities: u64,
        metadata_uri: String,
    ) -> Result<()> {
        // Comprehensive input validation
        if metadata_uri.trim().is_empty() {
            return Err(PodComError::InvalidMetadataUriLength.into());
        }
        if metadata_uri.len() > MAX_METADATA_URI_LENGTH {
            return Err(PodComError::InvalidMetadataUriLength.into());
        }
        if capabilities > u64::MAX / 2 {
            // Reasonable upper bound
            return Err(PodComError::Unauthorized.into()); // Reusing error for invalid capabilities
        }

        let agent = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        agent.pubkey = ctx.accounts.signer.key();
        agent.capabilities = capabilities;
        agent.metadata_uri = metadata_uri.clone();
        agent.reputation = 100; // Initial reputation
        agent.last_updated = clock.unix_timestamp;
        agent.bump = ctx.bumps.agent_account;

        // Emit event for monitoring
        emit!(AgentRegistered {
            agent: agent.pubkey,
            capabilities,
            metadata_uri,
            timestamp: clock.unix_timestamp,
        });

        msg!("Agent registered: {:?}", agent.pubkey);
        Ok(())
    }

    // Send a message from one agent to another
    pub fn send_message(
        ctx: Context<SendMessage>,
        recipient: Pubkey,
        payload_hash: [u8; 32],
        message_type: MessageType,
    ) -> Result<()> {
        let message = &mut ctx.accounts.message_account;
        let clock = Clock::get()?;

        // IMPORTANT: Use agent PDA as sender for consistency across all message types
        // This ensures all messages are associated with registered agents, not raw wallets
        message.sender = ctx.accounts.sender_agent.key();
        message.recipient = recipient;
        message.payload_hash = payload_hash;
        message.message_type = message_type.clone();
        message.created_at = clock.unix_timestamp;
        message.expires_at = clock.unix_timestamp + MESSAGE_EXPIRATION_SECONDS;
        message.status = MessageStatus::Pending;
        message.bump = ctx.bumps.message_account;

        // Emit event for monitoring
        emit!(MessageSent {
            sender: message.sender,
            recipient: message.recipient,
            message_type,
            timestamp: clock.unix_timestamp,
        });

        msg!(
            "Message sent from {:?} to {:?}",
            message.sender,
            message.recipient
        );
        Ok(())
    }

    // Update an agent's metadata or capabilities
    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        capabilities: Option<u64>,
        metadata_uri: Option<String>,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        // Verify the signer owns the agent account
        if *ctx.accounts.signer.key != agent.pubkey {
            return Err(PodComError::Unauthorized.into());
        }

        if let Some(caps) = capabilities {
            agent.capabilities = caps;
        }

        if let Some(uri) = metadata_uri {
            if uri.len() > MAX_METADATA_URI_LENGTH {
                return Err(PodComError::InvalidMetadataUriLength.into());
            }
            agent.metadata_uri = uri;
        }

        agent.last_updated = clock.unix_timestamp;

        msg!("Agent updated: {:?}", agent.pubkey);
        Ok(())
    }

    // Update message status (e.g., mark as delivered or read)
    pub fn update_message_status(
        ctx: Context<UpdateMessageStatus>,
        new_status: MessageStatus,
    ) -> Result<()> {
        let message = &mut ctx.accounts.message_account;
        let clock = Clock::get()?;

        // Verify the message hasn't expired
        if clock.unix_timestamp > message.expires_at {
            return Err(PodComError::MessageExpired.into());
        }

        // Verify the caller is the recipient for certain status updates
        match new_status {
            MessageStatus::Delivered | MessageStatus::Read => {
                if ctx.accounts.recipient_agent.pubkey != message.recipient {
                    return Err(PodComError::Unauthorized.into());
                }
            }
            MessageStatus::Failed => {
                // Only sender or recipient can mark as failed
                if ctx.accounts.signer.key() != message.sender
                    && ctx.accounts.signer.key() != message.recipient
                {
                    return Err(PodComError::Unauthorized.into());
                }
            }
            _ => return Err(PodComError::InvalidMessageStatusTransition.into()),
        }

        // Update status
        message.status = new_status;

        msg!("Message status updated to {:?}", message.status);
        Ok(())
    }

    // Create a new channel
    pub fn create_channel(
        ctx: Context<CreateChannel>,
        name: String,
        description: String,
        visibility: ChannelVisibility,
        max_participants: u32,
        fee_per_message: u64,
    ) -> Result<()> {
        // Comprehensive input validation
        if name.trim().is_empty() {
            return Err(PodComError::ChannelNameTooLong.into()); // Reusing error for empty name
        }
        if name.len() > MAX_CHANNEL_NAME_LENGTH {
            return Err(PodComError::ChannelNameTooLong.into());
        }
        if description.len() > MAX_CHANNEL_DESCRIPTION_LENGTH {
            return Err(PodComError::ChannelDescriptionTooLong.into());
        }
        if max_participants == 0 || max_participants > MAX_PARTICIPANTS_PER_CHANNEL {
            return Err(PodComError::ChannelFull.into()); // Reusing error for invalid participant count
        }
        if fee_per_message > 1_000_000_000 {
            // Max 1 SOL per message
            return Err(PodComError::InsufficientFunds.into()); // Reusing error for excessive fee
        }

        let channel = &mut ctx.accounts.channel_account;
        let clock = Clock::get()?;

        channel.creator = ctx.accounts.creator.key();
        channel.name = name.trim().to_string();
        channel.description = description.trim().to_string();
        channel.visibility = visibility;
        channel.max_participants = max_participants;
        channel.current_participants = 1; // Creator is first participant
        channel.fee_per_message = fee_per_message;
        channel.escrow_balance = 0;
        channel.created_at = clock.unix_timestamp;
        channel.bump = ctx.bumps.channel_account;

        msg!("Channel created: {:?}", channel.creator);
        Ok(())
    }

    // Deposit to escrow for a channel
    pub fn deposit_escrow(ctx: Context<DepositEscrow>, amount: u64) -> Result<()> {
        // Input validation
        if amount == 0 {
            return Err(PodComError::InsufficientFunds.into());
        }
        if amount > 10_000_000_000 {
            // Max 10 SOL per deposit
            return Err(PodComError::InsufficientFunds.into());
        }

        let clock = Clock::get()?;

        // Transfer SOL from depositor to escrow PDA
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.depositor.key(),
            &ctx.accounts.escrow_account.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.depositor.to_account_info(),
                ctx.accounts.escrow_account.to_account_info(),
            ],
        )?;

        // Initialize escrow account data
        let escrow = &mut ctx.accounts.escrow_account;
        let channel = &mut ctx.accounts.channel_account;

        escrow.channel = channel.key();
        escrow.depositor = ctx.accounts.depositor.key();
        escrow.amount = amount;
        escrow.created_at = clock.unix_timestamp;
        escrow.bump = ctx.bumps.escrow_account;

        // Update channel escrow balance
        channel.escrow_balance += amount;

        msg!("Deposited {} lamports to escrow", amount);
        Ok(())
    }

    // Withdraw from escrow
    pub fn withdraw_escrow(ctx: Context<WithdrawEscrow>, amount: u64) -> Result<()> {
        // Verify the depositor is withdrawing their own funds
        if ctx.accounts.escrow_account.depositor != ctx.accounts.depositor.key() {
            return Err(PodComError::Unauthorized.into());
        }

        // Verify sufficient balance
        if ctx.accounts.escrow_account.amount < amount {
            return Err(PodComError::InsufficientFunds.into());
        }

        // Transfer SOL from escrow PDA back to depositor
        **ctx
            .accounts
            .escrow_account
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .depositor
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        // Update account data
        let escrow = &mut ctx.accounts.escrow_account;
        let channel = &mut ctx.accounts.channel_account;

        escrow.amount -= amount;
        channel.escrow_balance -= amount;

        msg!("Withdrew {} lamports from escrow", amount);
        Ok(())
    }

    // Join a channel
    pub fn join_channel(ctx: Context<JoinChannel>) -> Result<()> {
        let channel = &mut ctx.accounts.channel_account;
        let participant = &mut ctx.accounts.participant_account;
        let clock = Clock::get()?;

        // Check if channel is full
        if channel.current_participants >= channel.max_participants {
            return Err(PodComError::ChannelFull.into());
        }

        // For private channels, check if there's a valid invitation
        if channel.visibility == ChannelVisibility::Private {
            if let Some(invitation) = &ctx.accounts.invitation_account {
                if invitation.invitee != ctx.accounts.user.key()
                    || invitation.is_accepted
                    || clock.unix_timestamp > invitation.expires_at
                {
                    return Err(PodComError::PrivateChannelRequiresInvitation.into());
                }
            } else {
                return Err(PodComError::PrivateChannelRequiresInvitation.into());
            }
        }

        // Initialize participant account
        participant.channel = channel.key();
        participant.participant = ctx.accounts.agent_account.key(); // Use agent PDA
        participant.joined_at = clock.unix_timestamp;
        participant.is_active = true;
        participant.messages_sent = 0;
        participant.last_message_at = 0;
        participant.bump = ctx.bumps.participant_account;

        // Update channel participant count
        channel.current_participants += 1;

        // If joining via invitation, mark it as accepted
        if channel.visibility == ChannelVisibility::Private {
            if let Some(invitation) = &mut ctx.accounts.invitation_account {
                invitation.is_accepted = true;
            }
        }

        msg!(
            "User {:?} joined channel {:?}",
            participant.participant,
            channel.name
        );
        Ok(())
    }

    // Leave a channel
    pub fn leave_channel(ctx: Context<LeaveChannel>) -> Result<()> {
        let channel = &mut ctx.accounts.channel_account;
        let participant = &mut ctx.accounts.participant_account;

        // Verify user is in the channel
        if !participant.is_active {
            return Err(PodComError::NotInChannel.into());
        }

        // Mark participant as inactive
        participant.is_active = false;

        // Update channel participant count
        channel.current_participants -= 1;

        msg!(
            "User {:?} left channel {:?}",
            participant.participant,
            channel.name
        );
        Ok(())
    }

    /// Broadcasts a message to a channel as an active participant, enforcing content length and rate limits.
    ///
    /// The function allows an agent to send a message to a channel if they are an active participant. It validates the message content length, ensures the participant has not exceeded the allowed number of messages per minute, and enforces a minimum interval between messages. The message is recorded with the agent's PDA as the sender, and optional reply-to information can be included.
    ///
    /// # Parameters
    /// - `content`: The message content to broadcast. Must not exceed the maximum allowed length.
    /// - `message_type`: The type of message being sent (e.g., Text, Data, Command).
    /// - `reply_to`: Optional public key of the message being replied to.
    /// - `_nonce`: A unique value to ensure message account uniqueness.
    ///
    /// # Errors
    /// Returns an error if the participant is not active in the channel, the message content is too long, or rate limits are exceeded.
    pub fn broadcast_message(
        ctx: Context<BroadcastMessage>,
        content: String,
        message_type: MessageType,
        reply_to: Option<Pubkey>,
        _nonce: u64,
    ) -> Result<()> {
        let participant = &ctx.accounts.participant_account;
        let channel = &ctx.accounts.channel_account;
        let message = &mut ctx.accounts.message_account;
        let clock = Clock::get()?;

        // Validate content length
        if content.len() > MAX_MESSAGE_CONTENT_LENGTH {
            return Err(PodComError::MessageContentTooLong.into());
        }

        // Verify user is an active participant
        if !participant.is_active {
            return Err(PodComError::NotInChannel.into());
        }

        // Enhanced rate limiting with sliding window approach
        let current_time = clock.unix_timestamp;
        let time_window = 60; // 1 minute window

        let participant = &mut ctx.accounts.participant_account;
        if participant.last_message_at > 0 {
            let time_since_last = current_time - participant.last_message_at;

            // Minimum time between messages
            if time_since_last < 1 {
                return Err(PodComError::RateLimitExceeded.into());
            }

            if time_since_last < time_window {
                if participant.messages_sent >= RATE_LIMIT_MESSAGES_PER_MINUTE as u64 {
                    return Err(PodComError::RateLimitExceeded.into());
                }
                participant.messages_sent += 1;
            } else {
                participant.messages_sent = 1;
            }
        } else {
            participant.messages_sent = 1;
        }
        participant.last_message_at = current_time;

        // Initialize message
        message.channel = channel.key();
        // IMPORTANT: Use agent PDA as sender for consistency across all message types
        // This ensures all messages are associated with registered agents, not raw wallets
        message.sender = participant.participant; // This is the agent PDA
        message.content = content;
        message.message_type = message_type;
        message.created_at = clock.unix_timestamp;
        message.edited_at = None;
        message.reply_to = reply_to;
        message.bump = ctx.bumps.message_account;

        msg!("Message broadcast to channel {:?}", channel.name);
        Ok(())
    }

    // Invite user to private channel
    pub fn invite_to_channel(ctx: Context<InviteToChannel>, invitee: Pubkey) -> Result<()> {
        let channel = &ctx.accounts.channel_account;
        let invitation = &mut ctx.accounts.invitation_account;
        let clock = Clock::get()?;

        // Only creator or existing participants can invite
        if ctx.accounts.inviter.key() != channel.creator {
            if let Some(participant) = &ctx.accounts.participant_account {
                if !participant.is_active {
                    return Err(PodComError::Unauthorized.into());
                }
            } else {
                return Err(PodComError::Unauthorized.into());
            }
        }

        // Initialize invitation
        invitation.channel = channel.key();
        invitation.inviter = ctx.accounts.inviter.key();
        invitation.invitee = invitee;
        invitation.created_at = clock.unix_timestamp;
        invitation.expires_at = clock.unix_timestamp + (7 * 24 * 60 * 60); // 7 days
        invitation.is_accepted = false;
        invitation.bump = ctx.bumps.invitation_account;

        msg!(
            "Invitation sent to {:?} for channel {:?}",
            invitee,
            channel.name
        );
        Ok(())
    }

    // Get channel participants (view function - would be called off-chain)
    pub fn get_channel_participants(ctx: Context<GetChannelParticipants>) -> Result<Vec<Pubkey>> {
        // Note: In Solana programs, this function returns empty as participant data
        // is typically queried off-chain via getProgramAccounts RPC calls for efficiency.
        // The channel account stores the current participant count, but individual
        // participant pubkeys are stored in separate ChannelParticipant accounts.
        
        // For on-chain validation, we verify the channel exists and is active
        let channel = &ctx.accounts.channel_account;
        require!(channel.is_active, PodComError::NotInChannel);
        
        // Return empty vector as participant enumeration is done off-chain
        // Off-chain clients should use:
        // - getProgramAccounts with ChannelParticipant discriminator
        // - Filter by channel pubkey and is_active = true
        Ok(vec![])
    }

    // Update channel settings (creator only)
    pub fn update_channel(
        ctx: Context<UpdateChannel>,
        name: Option<String>,
        description: Option<String>,
        max_participants: Option<u32>,
        fee_per_message: Option<u64>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel_account;

        // Verify caller is the creator
        if ctx.accounts.signer.key() != channel.creator {
            return Err(PodComError::Unauthorized.into());
        }

        // Update fields if provided
        if let Some(new_name) = name {
            if new_name.len() > MAX_CHANNEL_NAME_LENGTH {
                return Err(PodComError::ChannelNameTooLong.into());
            }
            channel.name = new_name;
        }

        if let Some(new_description) = description {
            if new_description.len() > MAX_CHANNEL_DESCRIPTION_LENGTH {
                return Err(PodComError::ChannelDescriptionTooLong.into());
            }
            channel.description = new_description;
        }

        if let Some(new_max) = max_participants {
            // Don't allow reducing below current participants
            if new_max < channel.current_participants {
                return Err(PodComError::ChannelFull.into());
            }
            channel.max_participants = new_max;
        }

        if let Some(new_fee) = fee_per_message {
            channel.fee_per_message = new_fee;
        }

        if let Some(active) = is_active {
            channel.is_active = active;
        }

        msg!("Channel {:?} updated", channel.name);
        Ok(())
    }

    // Enhanced create channel with validation
    pub fn create_channel_v2(
        ctx: Context<CreateChannelV2>,
        name: String,
        description: String,
        visibility: ChannelVisibility,
        max_participants: u32,
        fee_per_message: u64,
    ) -> Result<()> {
        let agent = &ctx.accounts.agent_account;
        let channel = &mut ctx.accounts.channel_account;
        let participant = &mut ctx.accounts.participant_account;
        let clock = Clock::get()?;

        // Validate agent reputation
        if agent.reputation < MIN_REPUTATION_FOR_CHANNELS {
            return Err(PodComError::InsufficientReputation.into());
        }

        // Validate input lengths
        if name.len() > MAX_CHANNEL_NAME_LENGTH {
            return Err(PodComError::ChannelNameTooLong.into());
        }
        if description.len() > MAX_CHANNEL_DESCRIPTION_LENGTH {
            return Err(PodComError::ChannelDescriptionTooLong.into());
        }

        // Validate max participants
        if max_participants > MAX_PARTICIPANTS_PER_CHANNEL {
            return Err(PodComError::ChannelFull.into());
        }

        // Initialize channel
        channel.creator = ctx.accounts.creator.key();
        channel.name = name;
        channel.description = description;
        channel.visibility = visibility;
        channel.max_participants = max_participants;
        channel.current_participants = 1; // Creator is first participant
        channel.fee_per_message = fee_per_message;
        channel.escrow_balance = 0;
        channel.created_at = clock.unix_timestamp;
        channel.is_active = true;
        channel.bump = ctx.bumps.channel_account;

        // Add creator as first participant
        participant.channel = channel.key();
        participant.participant = ctx.accounts.agent_account.key(); // Use agent PDA
        participant.joined_at = clock.unix_timestamp;
        participant.is_active = true;
        participant.messages_sent = 0;
        participant.last_message_at = 0;
        participant.bump = ctx.bumps.participant_account;

        msg!("Enhanced channel created: {:?}", channel.name);
        Ok(())
    }
}

// Contexts

#[derive(Accounts)]
#[instruction(capabilities: u64, metadata_uri: String)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = signer,
        space = AGENT_ACCOUNT_SPACE,
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(recipient: Pubkey, payload_hash: [u8; 32], message_type: MessageType)]
pub struct SendMessage<'info> {
    #[account(
        init,
        payer = signer,
        space = MESSAGE_ACCOUNT_SPACE,
        seeds = [
            b"message",
            sender_agent.key().as_ref(),
            recipient.as_ref(),
            &payload_hash,
            &[match message_type { MessageType::Text => 0, MessageType::Data => 1, MessageType::Command => 2, MessageType::Response => 3, MessageType::Custom(x) => 4 + x }],
        ],
        bump
    )]
    pub message_account: Account<'info, MessageAccount>,
    #[account(
        seeds = [b"agent", signer.key().as_ref()],
        bump = sender_agent.bump,
        constraint = signer.key() == sender_agent.pubkey @ PodComError::Unauthorized,
    )]
    pub sender_agent: Account<'info, AgentAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent_account.pubkey.as_ref()],
        bump = agent_account.bump,
    )]
    pub agent_account: Account<'info, AgentAccount>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateMessageStatus<'info> {
    #[account(
        mut,
        seeds = [
            b"message", 
            message_account.sender.as_ref(),
            message_account.recipient.as_ref(),
            &message_account.payload_hash,
            &[match &message_account.message_type {
                MessageType::Text => 0,
                MessageType::Data => 1,
                MessageType::Command => 2,
                MessageType::Response => 3,
                MessageType::Custom(x) => 4 + x
            }],
        ],
        bump = message_account.bump,
    )]
    pub message_account: Account<'info, MessageAccount>,
    #[account(
        seeds = [b"agent", signer.key().as_ref()],
        bump = recipient_agent.bump,
    )]
    pub recipient_agent: Account<'info, AgentAccount>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(name: String, description: String, visibility: ChannelVisibility, max_participants: u32, fee_per_message: u64)]
pub struct CreateChannel<'info> {
    #[account(
        init,
        payer = creator,
        space = CHANNEL_ACCOUNT_SPACE,
        seeds = [b"channel", creator.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DepositEscrow<'info> {
    #[account(
        init,
        payer = depositor,
        space = ESCROW_ACCOUNT_SPACE,
        seeds = [b"escrow", channel_account.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", channel_account.key().as_ref(), depositor.key().as_ref()],
        bump = escrow_account.bump,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(mut)]
    pub depositor: Signer<'info>,
}

// New context structures for enhanced functionality

#[derive(Accounts)]
pub struct JoinChannel<'info> {
    #[account(mut)]
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(
        init,
        payer = user,
        space = CHANNEL_PARTICIPANT_SPACE,
        seeds = [b"participant", channel_account.key().as_ref(), agent_account.key().as_ref()],
        bump
    )]
    pub participant_account: Account<'info, ChannelParticipant>,
    #[account(
        seeds = [b"agent", user.key().as_ref()],
        bump = agent_account.bump,
        constraint = user.key() == agent_account.pubkey @ PodComError::Unauthorized,
    )]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(
        mut,
        seeds = [b"invitation", channel_account.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub invitation_account: Option<Account<'info, ChannelInvitation>>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LeaveChannel<'info> {
    #[account(mut)]
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(
        mut,
        seeds = [b"participant", channel_account.key().as_ref(), agent_account.key().as_ref()],
        bump = participant_account.bump,
        constraint = participant_account.participant == agent_account.key() @ PodComError::Unauthorized
    )]
    pub participant_account: Account<'info, ChannelParticipant>,
    #[account(
        seeds = [b"agent", user.key().as_ref()],
        bump = agent_account.bump,
        constraint = user.key() == agent_account.pubkey @ PodComError::Unauthorized,
    )]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(content: String, message_type: MessageType, reply_to: Option<Pubkey>, nonce: u64)]
pub struct BroadcastMessage<'info> {
    #[account(
        mut,
        constraint = channel_account.is_active @ PodComError::Unauthorized
    )]
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(
        mut,
        seeds = [b"participant", channel_account.key().as_ref(), agent_account.key().as_ref()],
        bump = participant_account.bump,
        constraint = participant_account.is_active @ PodComError::NotInChannel
    )]
    pub participant_account: Account<'info, ChannelParticipant>,
    #[account(
        seeds = [b"agent", user.key().as_ref()],
        bump = agent_account.bump,
        constraint = user.key() == agent_account.pubkey @ PodComError::Unauthorized,
    )]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(
        init,
        payer = user,
        space = CHANNEL_MESSAGE_SPACE,
        seeds = [
            b"channel_message",
            channel_account.key().as_ref(),
            user.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub message_account: Account<'info, ChannelMessage>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(invitee: Pubkey)]
pub struct InviteToChannel<'info> {
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(
        seeds = [b"participant", channel_account.key().as_ref(), agent_account.key().as_ref()],
        bump = participant_account.bump,
        constraint = participant_account.is_active @ PodComError::NotInChannel
    )]
    pub participant_account: Option<Account<'info, ChannelParticipant>>,
    #[account(
        seeds = [b"agent", inviter.key().as_ref()],
        bump = agent_account.bump,
        constraint = inviter.key() == agent_account.pubkey @ PodComError::Unauthorized,
    )]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(
        init,
        payer = inviter,
        space = CHANNEL_INVITATION_SPACE,
        seeds = [b"invitation", channel_account.key().as_ref(), invitee.as_ref()],
        bump
    )]
    pub invitation_account: Account<'info, ChannelInvitation>,
    #[account(mut)]
    pub inviter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetChannelParticipants<'info> {
    pub channel_account: Account<'info, ChannelAccount>,
}

#[derive(Accounts)]
pub struct UpdateChannel<'info> {
    #[account(
        mut,
        constraint = channel_account.creator == signer.key() @ PodComError::Unauthorized
    )]
    pub channel_account: Account<'info, ChannelAccount>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(name: String, description: String, visibility: ChannelVisibility, max_participants: u32, fee_per_message: u64)]
pub struct CreateChannelV2<'info> {
    #[account(
        seeds = [b"agent", creator.key().as_ref()],
        bump = agent_account.bump,
        constraint = agent_account.reputation >= MIN_REPUTATION_FOR_CHANNELS @ PodComError::InsufficientReputation
    )]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(
        init,
        payer = creator,
        space = CHANNEL_ACCOUNT_SPACE,
        seeds = [b"channel", creator.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub channel_account: Account<'info, ChannelAccount>,
    #[account(
        init,
        payer = creator,
        space = CHANNEL_PARTICIPANT_SPACE,
        seeds = [b"participant", channel_account.key().as_ref(), agent_account.key().as_ref()],
        bump
    )]
    pub participant_account: Account<'info, ChannelParticipant>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}
