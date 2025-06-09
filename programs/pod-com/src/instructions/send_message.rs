use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

/// Send a message through a channel
/// 
/// This instruction creates a Message account, deducts fees from escrow,
/// and updates relevant statistics and agent metrics.
pub fn handler(
    ctx: Context<SendMessage>,
    message_type: MessageType,
    content_hash: [u8; 32],
    metadata: String,
) -> Result<()> {
    
    // Validate input parameters
    require!(
        Message::validate_metadata(&metadata),
        PodComError::InvalidMessageType
    );
    
    require!(
        content_hash != [0; 32],
        PodComError::InvalidContentHash
    );
    
    let channel = &mut ctx.accounts.channel;
    let sender_agent = &mut ctx.accounts.sender_agent;
    let message = &mut ctx.accounts.message;
    let stats = &mut ctx.accounts.message_stats;
    
    // Check if sender is authorized for this channel
    require!(
        channel.is_participant(&sender_agent.agent_id),
        PodComError::AgentNotAuthorized
    );
    
    // Calculate effective fee for this message
    let effective_fee = channel.get_effective_fee(sender_agent.fee_per_message);
    
    // Check if channel has sufficient escrow
    require!(
        channel.can_afford_message(effective_fee),
        PodComError::InsufficientEscrow
    );
    
    // Create the message
    *message = Message::new(
        ctx.accounts.message.key(),
        channel.channel_id,
        sender_agent.agent_id,
        ctx.accounts.recipient_agent.as_ref().map(|a| a.agent_id),
        message_type.clone(),
        content_hash,
        metadata,
        effective_fee,
    );
    
    // Deduct fee from channel escrow
    channel.deduct_fee(effective_fee)?;
    
    // Update channel statistics
    channel.record_message();
    
    // Update sender agent statistics
    sender_agent.messages_sent += 1;
    sender_agent.fees_spent += effective_fee;
    sender_agent.update_activity();
    
    // Update recipient agent statistics (if direct message)
    if let Some(recipient_agent) = ctx.accounts.recipient_agent.as_mut() {
        recipient_agent.messages_received += 1;
        recipient_agent.fees_earned += effective_fee;
        recipient_agent.update_activity();
    }
    
    // Update message statistics
    stats.record_message(&message_type, effective_fee);
    
    // Transfer fee to recipient (if direct message) or distribute among participants
    if let Some(_recipient_agent) = ctx.accounts.recipient_agent.as_ref() {
        // For direct messages, transfer fee to recipient
        let escrow_account = &mut ctx.accounts.escrow_account;
        let recipient_info = ctx.accounts.recipient_agent.as_ref().unwrap().to_account_info();
        
        **escrow_account.try_borrow_mut_lamports()? -= effective_fee;
        **recipient_info.try_borrow_mut_lamports()? += effective_fee;
    }
    
    msg!(
        "Message sent: {} -> {} (type: {:?}, fee: {})",
        sender_agent.agent_id,
        message.recipient.unwrap_or(Pubkey::default()),
        message_type,
        effective_fee
    );
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(message_type: MessageType, content_hash: [u8; 32], metadata: String)]
pub struct SendMessage<'info> {
    /// Message account to be created
    #[account(
        init,
        payer = sender,
        space = Message::space(&metadata),
        seeds = [
            b"message",
            channel.key().as_ref(),
            sender_agent.key().as_ref(),
            &Clock::get()?.unix_timestamp.to_le_bytes()
        ],
        bump
    )]
    pub message: Account<'info, Message>,
    
    /// Channel the message is being sent to
    #[account(mut)]
    pub channel: Account<'info, Channel>,
    
    /// Escrow account for the channel
    #[account(mut)]
    /// CHECK: This is the channel's escrow PDA
    pub escrow_account: AccountInfo<'info>,
    
    /// Agent sending the message
    #[account(
        mut,
        constraint = sender_agent.owner == sender.key() @ PodComError::AgentNotAuthorized
    )]
    pub sender_agent: Account<'info, Agent>,
    
    /// Optional recipient agent (for direct messages)
    #[account(mut)]
    pub recipient_agent: Option<Account<'info, Agent>>,
    
    /// Message statistics account
    #[account(mut)]
    pub message_stats: Account<'info, MessageStats>,
    
    /// Sender/authority
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
