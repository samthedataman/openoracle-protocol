"""
Poll/Market API methods
Handles prediction market creation, management, and resolution
"""

from typing import Dict, Any, Optional, List
from decimal import Decimal
import logging

from ..core.client import OpenOracleClient
from ..schemas.oracle_schemas import DataCategory

logger = logging.getLogger(__name__)


class PollAPI:
    """API methods for poll/prediction market operations"""
    
    def __init__(self, client: OpenOracleClient):
        self.client = client
    
    # ============ Poll Creation ============
    
    async def create_poll(self, poll_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a standard poll
        
        Args:
            poll_data: Poll configuration including:
                - question: Poll question
                - options: List of poll options
                - duration: Poll duration in seconds
                - poll_type: Type of poll ('binary', 'multiple_choice', 'numeric')
                - creator: Creator address/ID
        
        Returns:
            Created poll information
        """
        response = await self.client.post('/api/polls/', json_data=poll_data)
        return response
    
    async def create_oracle_poll(self, poll_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a poll with oracle backing for automatic resolution
        
        Args:
            poll_data: Oracle poll configuration including:
                - question: Poll question 
                - poll_id: Unique poll identifier
                - auto_resolve: Whether to auto-resolve using oracle data
                - category_hint: Data category hint for oracle routing
        
        Returns:
            Created poll with oracle configuration
        """
        response = await self.client.post('/api/oracle/create-oracle-poll', json_data=poll_data)
        return response
    
    async def create_prediction_market(
        self,
        question: str,
        market_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a prediction market with betting functionality
        
        Args:
            question: Market question
            market_config: Market configuration including:
                - min_bet: Minimum bet amount
                - max_bet: Maximum bet amount  
                - duration: Market duration
                - fee_percentage: Platform fee
                - early_bird_multiplier: Bonus for early bets
        
        Returns:
            Created prediction market
        """
        request_data = {
            'question': question,
            'market_config': market_config or {}
        }
        
        response = await self.client.post('/api/prediction-markets/', json_data=request_data)
        return response
    
    async def create_binary_market(
        self,
        question: str,
        yes_option: str = "Yes",
        no_option: str = "No",
        duration_hours: int = 24,
        oracle_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a simple binary prediction market"""
        request_data = {
            'question': question,
            'poll_type': 'binary',
            'options': [yes_option, no_option],
            'duration_hours': duration_hours,
            'oracle_config': oracle_config
        }
        
        response = await self.client.post('/api/prediction-markets/binary', json_data=request_data)
        return response
    
    # ============ Poll Management ============
    
    async def get_poll(self, poll_id: str) -> Dict[str, Any]:
        """Get details of a specific poll"""
        response = await self.client.get(f'/api/polls/{poll_id}')
        return response
    
    async def list_polls(
        self,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        List polls with optional filters
        
        Args:
            filters: Optional filters including:
                - status: Poll status ('active', 'closed', 'resolved')
                - category: Poll category
                - creator: Creator filter
                - min_votes: Minimum vote count
                - created_after: Created after timestamp
            page: Page number for pagination
            limit: Number of results per page
        
        Returns:
            Paginated list of polls
        """
        params = {'page': page, 'limit': limit}
        if filters:
            params.update(filters)
        
        response = await self.client.get('/api/polls/', params=params)
        return response
    
    async def update_poll(self, poll_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update poll configuration (if allowed)"""
        response = await self.client.put(f'/api/polls/{poll_id}', json_data=updates)
        return response
    
    async def close_poll(self, poll_id: str) -> Dict[str, Any]:
        """Manually close a poll"""
        response = await self.client.post(f'/api/polls/{poll_id}/close')
        return response
    
    async def delete_poll(self, poll_id: str) -> Dict[str, Any]:
        """Delete a poll (if allowed)"""
        response = await self.client.delete(f'/api/polls/{poll_id}')
        return response
    
    # ============ Voting ============
    
    async def vote(
        self,
        poll_id: str,
        vote_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Cast a vote on a poll
        
        Args:
            poll_id: Poll identifier
            vote_data: Vote information including:
                - option_id: Selected option ID
                - voter_address: Voter's wallet address (for Web3 polls)
                - amount: Bet amount (for prediction markets)
                - signature: Web3 signature for verification
        
        Returns:
            Vote confirmation
        """
        response = await self.client.post(f'/api/polls/{poll_id}/vote', json_data=vote_data)
        return response
    
    async def place_bet(
        self,
        poll_id: str,
        bet_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Place a bet on a prediction market
        
        Args:
            poll_id: Market identifier
            bet_data: Bet information including:
                - option_id: Selected option
                - amount: Bet amount in wei/tokens
                - user_address: Bettor's address
                - signature: Transaction signature
        
        Returns:
            Bet confirmation
        """
        response = await self.client.post(f'/api/prediction-markets/{poll_id}/bet', json_data=bet_data)
        return response
    
    async def get_user_votes(
        self,
        user_address: str,
        poll_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get votes/bets for a specific user"""
        params = {'user_address': user_address}
        if poll_id:
            params['poll_id'] = poll_id
        
        response = await self.client.get('/api/polls/votes', params=params)
        return response.get('votes', [])
    
    # ============ Poll Statistics ============
    
    async def get_poll_stats(self, poll_id: str) -> Dict[str, Any]:
        """Get comprehensive statistics for a poll"""
        response = await self.client.get(f'/api/polls/{poll_id}/stats')
        return response
    
    async def get_voting_breakdown(self, poll_id: str) -> Dict[str, Any]:
        """Get detailed voting breakdown by option"""
        response = await self.client.get(f'/api/polls/{poll_id}/breakdown')
        return response
    
    async def get_betting_odds(self, poll_id: str) -> Dict[str, Any]:
        """Get current betting odds for a prediction market"""
        response = await self.client.get(f'/api/prediction-markets/{poll_id}/odds')
        return response
    
    async def get_market_depth(self, poll_id: str) -> Dict[str, Any]:
        """Get market depth information (order book style data)"""
        response = await self.client.get(f'/api/prediction-markets/{poll_id}/depth')
        return response
    
    async def get_price_history(
        self,
        poll_id: str,
        timeframe: str = "1h"
    ) -> List[Dict[str, Any]]:
        """Get price history for prediction market outcomes"""
        response = await self.client.get(f'/api/prediction-markets/{poll_id}/price-history', params={
            'timeframe': timeframe
        })
        return response.get('history', [])
    
    # ============ Poll Resolution ============
    
    async def resolve_poll(
        self,
        poll_id: str,
        resolution_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Manually resolve a poll
        
        Args:
            poll_id: Poll identifier
            resolution_data: Resolution information including:
                - winning_option_id: ID of winning option
                - resolution_reason: Reason for resolution
                - evidence: Supporting evidence/proof
                - resolver_address: Address of resolver
        
        Returns:
            Resolution confirmation
        """
        response = await self.client.post(f'/api/polls/{poll_id}/resolve', json_data=resolution_data)
        return response
    
    async def auto_resolve_poll(self, poll_id: str) -> Dict[str, Any]:
        """Trigger automatic resolution using oracle data"""
        response = await self.client.post(f'/api/polls/{poll_id}/auto-resolve')
        return response
    
    async def dispute_resolution(
        self,
        poll_id: str,
        dispute_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Dispute a poll resolution
        
        Args:
            poll_id: Poll identifier
            dispute_data: Dispute information including:
                - reason: Reason for dispute
                - evidence: Supporting evidence
                - disputer_address: Address of disputer
                - bond_amount: Dispute bond amount
        
        Returns:
            Dispute confirmation
        """
        response = await self.client.post(f'/api/polls/{poll_id}/dispute', json_data=dispute_data)
        return response
    
    async def get_resolution_status(self, poll_id: str) -> Dict[str, Any]:
        """Get current resolution status of a poll"""
        response = await self.client.get(f'/api/polls/{poll_id}/resolution')
        return response
    
    # ============ Rewards and Payouts ============
    
    async def calculate_payouts(self, poll_id: str) -> Dict[str, Any]:
        """Calculate payouts for all participants"""
        response = await self.client.get(f'/api/prediction-markets/{poll_id}/payouts')
        return response
    
    async def claim_rewards(
        self,
        poll_id: str,
        user_address: str,
        signature: str
    ) -> Dict[str, Any]:
        """Claim rewards from a resolved prediction market"""
        response = await self.client.post(f'/api/prediction-markets/{poll_id}/claim', json_data={
            'user_address': user_address,
            'signature': signature
        })
        return response
    
    async def get_user_rewards(self, user_address: str) -> Dict[str, Any]:
        """Get pending and claimable rewards for a user"""
        response = await self.client.get('/api/prediction-markets/rewards', params={
            'user_address': user_address
        })
        return response
    
    # ============ Market Analytics ============
    
    async def get_market_analytics(
        self,
        poll_id: str,
        timeframe: str = "24h"
    ) -> Dict[str, Any]:
        """Get comprehensive market analytics"""
        response = await self.client.get(f'/api/prediction-markets/{poll_id}/analytics', params={
            'timeframe': timeframe
        })
        return response
    
    async def get_trending_markets(
        self,
        category: Optional[str] = None,
        timeframe: str = "24h",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get trending prediction markets"""
        params = {'timeframe': timeframe, 'limit': limit}
        if category:
            params['category'] = category
        
        response = await self.client.get('/api/prediction-markets/trending', params=params)
        return response.get('markets', [])
    
    async def get_top_performers(
        self,
        metric: str = "volume",
        timeframe: str = "7d",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top performing markets by various metrics"""
        response = await self.client.get('/api/prediction-markets/top', params={
            'metric': metric,
            'timeframe': timeframe,
            'limit': limit
        })
        return response.get('markets', [])
    
    async def get_category_stats(self, category: str) -> Dict[str, Any]:
        """Get statistics for a specific market category"""
        response = await self.client.get(f'/api/prediction-markets/categories/{category}/stats')
        return response
    
    # ============ Social Features ============
    
    async def get_poll_comments(
        self,
        poll_id: str,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get comments/discussion for a poll"""
        response = await self.client.get(f'/api/polls/{poll_id}/comments', params={
            'page': page,
            'limit': limit
        })
        return response
    
    async def add_poll_comment(
        self,
        poll_id: str,
        comment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add a comment to a poll"""
        response = await self.client.post(f'/api/polls/{poll_id}/comments', json_data=comment_data)
        return response
    
    async def follow_poll(self, poll_id: str, user_address: str) -> Dict[str, Any]:
        """Follow a poll for updates"""
        response = await self.client.post(f'/api/polls/{poll_id}/follow', json_data={
            'user_address': user_address
        })
        return response
    
    async def unfollow_poll(self, poll_id: str, user_address: str) -> Dict[str, Any]:
        """Unfollow a poll"""
        response = await self.client.delete(f'/api/polls/{poll_id}/follow', json_data={
            'user_address': user_address
        })
        return response
    
    # ============ Advanced Market Types ============
    
    async def create_multi_outcome_market(
        self,
        question: str,
        outcomes: List[str],
        market_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a market with multiple possible outcomes"""
        request_data = {
            'question': question,
            'outcomes': outcomes,
            'market_type': 'multi_outcome',
            'config': market_config or {}
        }
        
        response = await self.client.post('/api/prediction-markets/multi-outcome', json_data=request_data)
        return response
    
    async def create_scalar_market(
        self,
        question: str,
        min_value: float,
        max_value: float,
        unit: str,
        market_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a scalar/numeric prediction market"""
        request_data = {
            'question': question,
            'min_value': min_value,
            'max_value': max_value,
            'unit': unit,
            'market_type': 'scalar',
            'config': market_config or {}
        }
        
        response = await self.client.post('/api/prediction-markets/scalar', json_data=request_data)
        return response
    
    async def create_conditional_market(
        self,
        primary_question: str,
        conditional_question: str,
        condition: str,
        market_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a conditional prediction market"""
        request_data = {
            'primary_question': primary_question,
            'conditional_question': conditional_question,
            'condition': condition,
            'market_type': 'conditional',
            'config': market_config or {}
        }
        
        response = await self.client.post('/api/prediction-markets/conditional', json_data=request_data)
        return response