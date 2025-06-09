use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

/// Create a new communication channel
/// 
/// This instruction creates a Channel account and associated escrow
/// for managing fees and participant interactions.
pub fn handler(
    ctx: Context<CreateChannel>,
    is_private: bool,
    initial_escrow: u64,
    max_participants: u8,
) -> Result<()> {
    
    // Validate input parameters
    require!(
        initial_escrow >= MIN_ESCROW_AMOUNT,
        PodComError::EscrowTooSmall
    );
    
    require!(
        max_participants > 0 && max_participants <= MAX_CHANNEL_PARTICIPANTS as u8,
        PodComError::ChannelAtCapacity
    );
    
    // Initialize the channel account
    let channel = &mut ctx.accounts.channel;
    let clock = Clock::get()?;
    
    // Generate unique channel ID from seeds
    channel.channel_id = ctx.accounts.channel.key();
    channel.creator = ctx.accounts.creator.key();
    channel.participants = vec![ctx.accounts.creator.key()]; // Creator is first participant
    channel.is_private = is_private;
    channel.max_participants = max_participants;
    channel.escrow_account = ctx.accounts.escrow_account.key();
    channel.escrow_balance = 0; // Will be set after transfer
    channel.fee_per_message = None; // Use agent default fees
    channel.message_count = 0;
    channel.created_at = clock.unix_timestamp;
    channel.last_message_at = clock.unix_timestamp;
    channel.is_active = true;
    channel.metadata = String::new();
    channel._reserved = [0; 128];
    
    // Transfer initial escrow to the escrow account
    if initial_escrow > 0 {
        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
            },
        );
        
        system_program::transfer(transfer_ctx, initial_escrow)?;
        channel.escrow_balance = initial_escrow;
    }
    
    // Initialize message stats account
    let stats = &mut ctx.accounts.message_stats;
    stats.channel_id = channel.channel_id;
    stats.total_messages = 0;
    stats.plain_text_count = 0;
    stats.function_call_count = 0;
    stats.data_stream_count = 0;
    stats.workflow_count = 0;
    stats.ai_prompt_count = 0;
    stats.media_count = 0;
    stats.code_count = 0;
    stats.total_fees = 0;
    stats.avg_fee = 0;
    stats.last_updated = clock.unix_timestamp;
    stats._reserved = [0; 128];
    
    msg!(
        "Channel created: {} by {} (private: {}, max_participants: {})",
        channel.channel_id,
        channel.creator,
        is_private,
        max_participants
    );
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(is_private: bool, initial_escrow: u64, max_participants: u8)]
pub struct CreateChannel<'info> {
    /// Channel account to be created
    #[account(
        init,
        payer = creator,
        space = Channel::space(&[creator.key()], ""),
        seeds = [b"channel", creator.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub channel: Account<'info, Channel>,
    
    /// Escrow account for holding channel fees
    #[account(
        init,
        payer = creator,
        space = 8 + 32, // Minimal account for holding lamports
        seeds = [b"escrow", channel.key().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA used only for holding lamports
    pub escrow_account: AccountInfo<'info>,
    
    /// Message statistics account
    #[account(
        init,
        payer = creator,
        space = MessageStats::LEN,
        seeds = [b"stats", channel.key().as_ref()],
        bump
    )]
    pub message_stats: Account<'info, MessageStats>,
    
    /// Creator/authority of the channel
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
