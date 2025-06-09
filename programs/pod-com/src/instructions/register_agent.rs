use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::*;
use crate::errors::*;

/// Register a new agent in the POD-COM network
/// 
/// This instruction creates a new Agent account and optionally
/// initializes a Reputation account for the agent.
pub fn handler(
    ctx: Context<RegisterAgent>,
    name: String,
    capabilities: Vec<String>,
    endpoint_url: Option<String>,
    fee_per_message: u64,
) -> Result<()> {
    
    // Validate input parameters
    require!(
        Agent::validate_name(&name),
        PodComError::AgentNameTooLong
    );
    
    require!(
        Agent::validate_capabilities(&capabilities),
        PodComError::InvalidCapabilities
    );
    
    require!(
        Agent::validate_endpoint_url(&endpoint_url),
        PodComError::MalformedEndpointUrl
    );
    
    require!(
        fee_per_message <= MAX_FEE_PER_MESSAGE,
        PodComError::FeePerMessageTooHigh
    );
    
    // Initialize the agent account
    let agent = &mut ctx.accounts.agent;
    let clock = Clock::get()?;
    
    agent.agent_id = ctx.accounts.owner.key();
    agent.name = name;
    agent.capabilities = capabilities;
    agent.endpoint_url = endpoint_url;
    agent.fee_per_message = fee_per_message;
    agent.owner = ctx.accounts.owner.key();
    agent.created_at = clock.unix_timestamp;
    agent.last_active = clock.unix_timestamp;
    agent.is_active = true;
    agent.messages_sent = 0;
    agent.messages_received = 0;
    agent.fees_earned = 0;
    agent.fees_spent = 0;
    agent.reputation_score = 5000; // Start at 50%
    agent.review_count = 0;
    agent._reserved = [0; 128];
    
    // Initialize reputation account if provided
    if let Some(reputation_account) = ctx.accounts.reputation.as_mut() {
        **reputation_account = Reputation::new(agent.agent_id);
    }
    
    msg!(
        "Agent registered: {} ({})",
        agent.name,
        agent.agent_id
    );
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String, capabilities: Vec<String>, endpoint_url: Option<String>)]
pub struct RegisterAgent<'info> {
    /// Agent account to be created
    #[account(
        init,
        payer = owner,
        space = Agent::space(&name, &capabilities, &endpoint_url),
        seeds = [b"agent", owner.key().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    
    /// Optional reputation account
    #[account(
        init,
        payer = owner,
        space = Reputation::LEN,
        seeds = [b"reputation", owner.key().as_ref()],
        bump
    )]
    pub reputation: Option<Account<'info, Reputation>>,
    
    /// Owner/authority of the agent
    #[account(mut)]
    pub owner: Signer<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
