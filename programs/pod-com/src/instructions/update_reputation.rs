use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

/// Update an agent's reputation based on peer review
/// 
/// This instruction allows agents to rate each other's performance
/// in various categories, building a decentralized reputation system.
pub fn handler(
    ctx: Context<UpdateReputation>,
    rating: u8,
    review_type: ReputationType,
) -> Result<()> {
    
    let reviewer = &ctx.accounts.reviewer_agent;
    let target_reputation = &mut ctx.accounts.target_reputation;
    let target_agent = &mut ctx.accounts.target_agent;
    
    // Prevent self-review
    require!(
        reviewer.agent_id != target_agent.agent_id,
        PodComError::SelfReview
    );
    
    // Validate rating range
    require!(
        rating >= 1 && rating <= 100,
        PodComError::InvalidRating
    );
    
    // Optional: Check if reviewer has minimum reputation to give reviews
    // This prevents spam reviews from low-reputation agents
    if let Some(reviewer_reputation) = ctx.accounts.reviewer_reputation.as_ref() {
        require!(
            reviewer_reputation.meets_minimum_reputation(30), // 30% minimum
            PodComError::InvalidRating
        );
    }
    
    // Add the review to the target agent's reputation
    target_reputation.add_review(review_type.clone(), rating)?;
    
    // Update the target agent's overall reputation score
    target_agent.reputation_score = target_reputation.overall_score;
    target_agent.review_count = target_reputation.total_reviews;
    
    // Update reviewer's activity (they're actively participating)
    if let Some(reviewer_reputation) = ctx.accounts.reviewer_reputation.as_mut() {
        // Slight reputation boost for providing reviews (max 1 point per review)
        if reviewer_reputation.total_reviews % 10 == 0 {
            // Every 10 reviews, give a small boost to helpfulness
            reviewer_reputation.add_review(ReputationType::Helpfulness, 60)?;
        }
    }
    
    msg!(
        "Reputation updated: {} rated {} with {} for {:?}",
        reviewer.agent_id,
        target_agent.agent_id,
        rating,
        review_type
    );
    
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    /// Agent providing the review
    #[account(
        constraint = reviewer_agent.owner == reviewer.key() @ PodComError::AgentNotAuthorized
    )]
    pub reviewer_agent: Account<'info, Agent>,
    
    /// Optional reputation account for the reviewer
    #[account(mut)]
    pub reviewer_reputation: Option<Account<'info, Reputation>>,
    
    /// Agent being reviewed
    #[account(mut)]
    pub target_agent: Account<'info, Agent>,
    
    /// Reputation account for the target agent
    #[account(
        mut,
        constraint = target_reputation.agent_id == target_agent.agent_id @ PodComError::AgentNotAuthorized
    )]
    pub target_reputation: Account<'info, Reputation>,
    
    /// Reviewer/authority
    pub reviewer: Signer<'info>,
}
