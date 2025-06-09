use anchor_lang::prelude::*;
use crate::state::*;

/// Reputation tracking account for agents
/// 
/// Stores detailed reputation metrics for each agent
/// based on peer reviews and system metrics.
#[account]
pub struct Reputation {
    /// Agent this reputation belongs to
    pub agent_id: Pubkey,
    
    /// Overall reputation score (weighted average, 0-10000)
    pub overall_score: u32,
    
    /// Response time reputation (0-100)
    pub response_time_score: u8,
    
    /// Accuracy reputation (0-100)
    pub accuracy_score: u8,
    
    /// Helpfulness reputation (0-100)
    pub helpfulness_score: u8,
    
    /// Reliability reputation (0-100)
    pub reliability_score: u8,
    
    /// Cost efficiency reputation (0-100)
    pub cost_efficiency_score: u8,
    
    /// Total number of reviews received
    pub total_reviews: u32,
    
    /// Reviews by type
    pub response_time_reviews: u32,
    pub accuracy_reviews: u32,
    pub helpfulness_reviews: u32,
    pub reliability_reviews: u32,
    pub cost_efficiency_reviews: u32,
    
    /// Number of times this agent has been penalized
    pub penalty_count: u16,
    
    /// Total penalty amount (in lamports)
    pub total_penalties: u64,
    
    /// Unix timestamp of last review
    pub last_review_at: i64,
    
    /// Unix timestamp when reputation was first created
    pub created_at: i64,
    
    /// Reserved space for future upgrades
    pub _reserved: [u8; 128],
}

impl Reputation {
    pub const LEN: usize = 8 + 32 + 4 + 5 + 4 * 6 + 2 + 8 + 8 + 8 + 128;
    
    /// Initialize a new reputation account
    pub fn new(agent_id: Pubkey) -> Self {
        let now = Clock::get().unwrap().unix_timestamp;
        Self {
            agent_id,
            overall_score: 5000, // Start at 50%
            response_time_score: 50,
            accuracy_score: 50,
            helpfulness_score: 50,
            reliability_score: 50,
            cost_efficiency_score: 50,
            total_reviews: 0,
            response_time_reviews: 0,
            accuracy_reviews: 0,
            helpfulness_reviews: 0,
            reliability_reviews: 0,
            cost_efficiency_reviews: 0,
            penalty_count: 0,
            total_penalties: 0,
            last_review_at: now,
            created_at: now,
            _reserved: [0; 128],
        }
    }
    
    /// Add a new review and update scores
    pub fn add_review(&mut self, review_type: ReputationType, rating: u8) -> Result<()> {
        require!(
            rating >= 1 && rating <= 100,
            crate::errors::PodComError::InvalidRating
        );
        
        match review_type {
            ReputationType::ResponseTime => {
                self.response_time_score = self.calculate_new_score(
                    self.response_time_score,
                    self.response_time_reviews,
                    rating,
                );
                self.response_time_reviews += 1;
            }
            ReputationType::Accuracy => {
                self.accuracy_score = self.calculate_new_score(
                    self.accuracy_score,
                    self.accuracy_reviews,
                    rating,
                );
                self.accuracy_reviews += 1;
            }
            ReputationType::Helpfulness => {
                self.helpfulness_score = self.calculate_new_score(
                    self.helpfulness_score,
                    self.helpfulness_reviews,
                    rating,
                );
                self.helpfulness_reviews += 1;
            }
            ReputationType::Reliability => {
                self.reliability_score = self.calculate_new_score(
                    self.reliability_score,
                    self.reliability_reviews,
                    rating,
                );
                self.reliability_reviews += 1;
            }
            ReputationType::CostEfficiency => {
                self.cost_efficiency_score = self.calculate_new_score(
                    self.cost_efficiency_score,
                    self.cost_efficiency_reviews,
                    rating,
                );
                self.cost_efficiency_reviews += 1;
            }
        }
        
        self.total_reviews += 1;
        self.last_review_at = Clock::get().unwrap().unix_timestamp;
        self.update_overall_score();
        
        Ok(())
    }
    
    /// Calculate new weighted average score
    fn calculate_new_score(&self, current_score: u8, review_count: u32, new_rating: u8) -> u8 {
        if review_count == 0 {
            new_rating
        } else {
            let total = (current_score as u32 * review_count) + new_rating as u32;
            (total / (review_count + 1)) as u8
        }
    }
    
    /// Update the overall weighted reputation score
    fn update_overall_score(&mut self) {
        // Weighted average with different importance for each metric
        let weighted_score = (
            self.response_time_score as u32 * 20 +    // 20% weight
            self.accuracy_score as u32 * 30 +         // 30% weight
            self.helpfulness_score as u32 * 25 +      // 25% weight
            self.reliability_score as u32 * 15 +      // 15% weight
            self.cost_efficiency_score as u32 * 10    // 10% weight
        ) / 100;
        
        // Apply penalty discount
        let penalty_discount = self.penalty_count.min(50) as u32 * 2; // Max 100% discount
        self.overall_score = (weighted_score * 100)
            .saturating_sub(penalty_discount * 100)
            .min(10000); // Max score of 10000 (100%)
    }
    
    /// Apply a penalty to the reputation
    pub fn apply_penalty(&mut self, penalty_amount: u64) {
        self.penalty_count += 1;
        self.total_penalties += penalty_amount;
        self.update_overall_score();
    }
    
    /// Get reputation as a percentage (0-100)
    pub fn get_percentage(&self) -> u8 {
        (self.overall_score / 100) as u8
    }
    
    /// Check if agent has minimum reputation for certain operations
    pub fn meets_minimum_reputation(&self, minimum: u8) -> bool {
        self.get_percentage() >= minimum
    }
}
