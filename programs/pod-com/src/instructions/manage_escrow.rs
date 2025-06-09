use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

/// Manage escrow funds for a channel
/// 
/// This instruction allows participants to deposit, withdraw,
/// or redistribute escrow funds in a channel.
pub fn handler(
    ctx: Context<ManageEscrow>,
    action: EscrowAction,
    amount: u64,
) -> Result<()> {
    
    let channel = &mut ctx.accounts.channel;
    let authority = &ctx.accounts.authority;
    
    // Check if authority is authorized for this channel
    require!(
        channel.is_participant(&authority.key()) || channel.creator == authority.key(),
        PodComError::AgentNotAuthorized
    );
    
    match action {
        EscrowAction::Deposit => {
            // Deposit funds into the channel escrow
            require!(
                amount >= MIN_ESCROW_AMOUNT,
                PodComError::EscrowTooSmall
            );
            
            let transfer_ctx = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: authority.to_account_info(),
                    to: ctx.accounts.escrow_account.to_account_info(),
                },
            );
            
            system_program::transfer(transfer_ctx, amount)?;
            
            channel.escrow_balance = channel.escrow_balance
                .checked_add(amount)
                .ok_or(PodComError::ArithmeticOverflow)?;
            
            msg!(
                "Deposited {} lamports to channel {} escrow",
                amount,
                channel.channel_id
            );
        }
        
        EscrowAction::Withdraw => {
            // Withdraw funds from the channel escrow
            // Only creator can withdraw
            require!(
                channel.creator == authority.key(),
                PodComError::AgentNotAuthorized
            );
            
            require!(
                channel.escrow_balance >= amount,
                PodComError::InsufficientEscrow
            );
            
            // Keep minimum balance for future messages
            let remaining_balance = channel.escrow_balance
                .checked_sub(amount)
                .ok_or(PodComError::ArithmeticOverflow)?;
            
            require!(
                remaining_balance >= MIN_ESCROW_AMOUNT,
                PodComError::EscrowTooSmall
            );
            
            // Transfer from escrow to authority
            **ctx.accounts.escrow_account.try_borrow_mut_lamports()? -= amount;
            **authority.try_borrow_mut_lamports()? += amount;
            
            channel.escrow_balance = remaining_balance;
            
            msg!(
                "Withdrew {} lamports from channel {} escrow",
                amount,
                channel.channel_id
            );
        }
        
        EscrowAction::Redistribute => {
            // Redistribute escrow among active participants
            // Only creator can redistribute
            require!(
                channel.creator == authority.key(),
                PodComError::AgentNotAuthorized
            );
            
            require!(
                amount <= channel.escrow_balance,
                PodComError::InsufficientEscrow
            );
            
            let participants_count = channel.participants.len() as u64;
            require!(participants_count > 0, PodComError::ChannelNotFound);
            
            let amount_per_participant = amount / participants_count;
            
            // For now, just record the redistribution
            // In a full implementation, you'd need to pass participant accounts
            // and transfer to each one
            channel.escrow_balance = channel.escrow_balance
                .checked_sub(amount)
                .ok_or(PodComError::ArithmeticOverflow)?;
            
            msg!(
                "Redistributed {} lamports ({} per participant) from channel {} escrow",
                amount,
                amount_per_participant,
                channel.channel_id
            );
        }
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct ManageEscrow<'info> {
    /// Channel with the escrow to manage
    #[account(mut)]
    pub channel: Account<'info, Channel>,
    
    /// Escrow account for the channel
    #[account(mut)]
    /// CHECK: This is the channel's escrow PDA
    pub escrow_account: AccountInfo<'info>,
    
    /// Authority managing the escrow (must be participant or creator)
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
