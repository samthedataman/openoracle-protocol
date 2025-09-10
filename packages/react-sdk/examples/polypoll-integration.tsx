/**
 * PolyPoll Integration Example
 * Shows how to integrate the React AI Router with the existing PolyPoll system
 */

import React, { useState, useEffect } from 'react';
import {
  AIRouterProvider,
  useAIRouter,
  generateViralPollRoute,
  generateTwitterPollRoute,
  AI_CONFIG_PRESETS,
  isWebLLMSupported,
  ViralPollResponse,
  TwitterBinaryPollResponse
} from '@polypoll/react-ai-router';

// Simulate the existing PolyPoll API
interface PolyPollAPI {
  createPoll: (pollData: any) => Promise<{ id: string; contractAddress: string }>;
  getArticleData: (url: string) => Promise<any>;
  getTweetData: (tweetUrl: string) => Promise<any>;
}

const polyPollAPI: PolyPollAPI = {
  async createPoll(pollData) {
    // This would call the actual PolyPoll backend
    const response = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pollData)
    });
    return response.json();
  },
  
  async getArticleData(url) {
    const response = await fetch(`/api/articles/extract?url=${encodeURIComponent(url)}`);
    return response.json();
  },
  
  async getTweetData(tweetUrl) {
    const response = await fetch(`/api/tweets/extract?url=${encodeURIComponent(tweetUrl)}`);
    return response.json();
  }
};

// Main PolyPoll App with AI Router
function PolyPollApp() {
  const [webLLMSupported, setWebLLMSupported] = useState<boolean | null>(null);

  useEffect(() => {
    isWebLLMSupported().then(setWebLLMSupported);
  }, []);

  // Configuration that prioritizes local models for privacy
  const config = {
    defaultProvider: webLLMSupported ? 
      { provider: 'web-llm' as const, model: 'Llama-3.2-3B-Instruct-q4f32_1' } :
      { provider: 'openai' as const, model: 'gpt-4', apiKey: process.env.REACT_APP_OPENAI_KEY || '' },
    fallbackProviders: [
      ...(process.env.REACT_APP_OPENAI_KEY ? [{
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        apiKey: process.env.REACT_APP_OPENAI_KEY
      }] : []),
      ...(webLLMSupported ? [{
        provider: 'web-llm' as const,
        model: 'Llama-3.2-1B-Instruct-q4f32_1'
      }] : [])
    ],
    enableRetries: true,
    maxRetries: 2,
    timeout: 45000,
    validateOutput: true
  };

  return (
    <AIRouterProvider config={config}>
      <div className="polypoll-app">
        <header>
          <h1>🎯 PolyPoll - AI-Powered Prediction Markets</h1>
          <AIProviderStatus />
        </header>
        
        <main>
          <div className="creator-grid">
            <ArticlePollCreator />
            <TwitterPollCreator />
            <RecentPolls />
          </div>
        </main>
      </div>
    </AIRouterProvider>
  );
}

// AI Provider Status Component
function AIProviderStatus() {
  const [status, setStatus] = useState<{
    current: string;
    available: string[];
    usingLocal: boolean;
  }>({
    current: 'Loading...',
    available: [],
    usingLocal: false
  });

  // This would be implemented to check actual provider status
  useEffect(() => {
    const checkStatus = async () => {
      const webLLMAvailable = await isWebLLMSupported();
      const openAIAvailable = !!process.env.REACT_APP_OPENAI_KEY;
      
      setStatus({
        current: webLLMAvailable ? 'WebLLM (Local)' : openAIAvailable ? 'OpenAI' : 'None',
        available: [
          ...(webLLMAvailable ? ['WebLLM'] : []),
          ...(openAIAvailable ? ['OpenAI'] : [])
        ],
        usingLocal: webLLMAvailable
      });
    };

    checkStatus();
  }, []);

  return (
    <div className="ai-status">
      <div className="current-provider">
        <span className="label">AI Provider:</span>
        <span className={`provider ${status.usingLocal ? 'local' : 'cloud'}`}>
          {status.current}
          {status.usingLocal && <span className="privacy-badge">🔒 Private</span>}
        </span>
      </div>
      <div className="available-providers">
        <span className="label">Available:</span>
        {status.available.map(provider => (
          <span key={provider} className="available-provider">
            {provider}
          </span>
        ))}
      </div>
    </div>
  );
}

// Article-based Poll Creator
function ArticlePollCreator() {
  const [articleUrl, setArticleUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPoll, setCreatedPoll] = useState<any>(null);
  
  const { execute: generatePoll, isLoading: isGenerating, error } = useAIRouter(generateViralPollRoute);

  const handleCreatePoll = async () => {
    if (!articleUrl.trim()) return;
    
    setIsCreating(true);
    try {
      // Step 1: Extract article data
      const articleData = await polyPollAPI.getArticleData(articleUrl);
      
      // Step 2: Generate AI poll
      const aiPoll: ViralPollResponse = await generatePoll({
        article_data: articleData,
        perspective: 'balanced',
        payment_token: 'FLOW'
      });
      
      // Step 3: Create poll in PolyPoll system
      const pollData = {
        question: aiPoll.question,
        options: [
          { text: aiPoll.serial_optimism, type: 'optimist' },
          { text: aiPoll.contrarian, type: 'contrarian' }, 
          { text: aiPoll.pessimistic, type: 'pessimist' },
          { text: aiPoll.hottake, type: 'hottake' }
        ],
        category: aiPoll.category,
        article_url: articleUrl,
        ai_metadata: {
          viral_score: aiPoll.metadata.viral_score,
          share_text: aiPoll.metadata.share_text,
          hashtags: aiPoll.metadata.hashtags,
          strategy: aiPoll.strategy
        }
      };
      
      const result = await polyPollAPI.createPoll(pollData);
      setCreatedPoll({ ...aiPoll, ...result });
      setArticleUrl('');
      
    } catch (err) {
      console.error('Failed to create poll from article:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="poll-creator article-creator">
      <h2>📰 Create Poll from Article</h2>
      
      <div className="input-section">
        <input
          type="url"
          value={articleUrl}
          onChange={(e) => setArticleUrl(e.target.value)}
          placeholder="Enter article URL..."
          className="article-input"
        />
        
        <button
          onClick={handleCreatePoll}
          disabled={!articleUrl.trim() || isCreating || isGenerating}
          className="create-btn"
        >
          {isCreating ? 'Creating Poll...' : isGenerating ? 'Generating...' : 'Create Poll'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ Error: {error.message}
        </div>
      )}

      {createdPoll && (
        <div className="created-poll">
          <h3>✅ Poll Created Successfully!</h3>
          <div className="poll-preview">
            <p className="question">{createdPoll.question}</p>
            <div className="options">
              {createdPoll.options.map((option: any, index: number) => (
                <div key={index} className={`option ${option.type}`}>
                  <span className="option-text">{option.text}</span>
                </div>
              ))}
            </div>
            <div className="poll-meta">
              <span className="viral-score">
                🔥 Viral Score: {(createdPoll.metadata.viral_score * 100).toFixed(0)}%
              </span>
              <span className="category">📂 {createdPoll.category}</span>
            </div>
            <div className="poll-links">
              <a href={`/polls/${createdPoll.id}`} className="view-poll">View Poll</a>
              <button 
                onClick={() => navigator.clipboard.writeText(createdPoll.metadata.share_text)}
                className="share-btn"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Twitter-based Poll Creator
function TwitterPollCreator() {
  const [tweetUrl, setTweetUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPoll, setCreatedPoll] = useState<any>(null);
  
  const { execute: generatePoll, isLoading: isGenerating, error } = useAIRouter(generateTwitterPollRoute);

  const handleCreatePoll = async () => {
    if (!tweetUrl.trim()) return;
    
    setIsCreating(true);
    try {
      // Step 1: Extract tweet data
      const tweetData = await polyPollAPI.getTweetData(tweetUrl);
      
      // Step 2: Generate AI poll
      const aiPoll: TwitterBinaryPollResponse = await generatePoll({
        tweet_data: tweetData,
        poll_type: 'binary'
      });
      
      // Step 3: Create poll in PolyPoll system
      const pollData = {
        question: aiPoll.question,
        options: aiPoll.options.map(opt => ({
          text: opt.text,
          value: opt.value,
          reasoning: opt.reasoning
        })),
        category: aiPoll.category,
        poll_type: 'binary',
        source_tweet: tweetUrl,
        ai_metadata: {
          confidence_level: aiPoll.confidence_level,
          resolution_timeframe: aiPoll.resolution_timeframe,
          tags: aiPoll.tags
        }
      };
      
      const result = await polyPollAPI.createPoll(pollData);
      setCreatedPoll({ ...aiPoll, ...result });
      setTweetUrl('');
      
    } catch (err) {
      console.error('Failed to create poll from tweet:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="poll-creator twitter-creator">
      <h2>🐦 Create Poll from Tweet</h2>
      
      <div className="input-section">
        <input
          type="url"
          value={tweetUrl}
          onChange={(e) => setTweetUrl(e.target.value)}
          placeholder="Enter tweet URL..."
          className="tweet-input"
        />
        
        <button
          onClick={handleCreatePoll}
          disabled={!tweetUrl.trim() || isCreating || isGenerating}
          className="create-btn"
        >
          {isCreating ? 'Creating Poll...' : isGenerating ? 'Generating...' : 'Create Poll'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ Error: {error.message}
        </div>
      )}

      {createdPoll && (
        <div className="created-poll">
          <h3>✅ Binary Poll Created!</h3>
          <div className="poll-preview">
            <p className="question">{createdPoll.question}</p>
            <div className="binary-options">
              {createdPoll.options.map((option: any, index: number) => (
                <div key={index} className={`binary-option ${option.value ? 'yes' : 'no'}`}>
                  <span className="option-text">{option.text}</span>
                  <span className="probability">{option.expected_percentage}%</span>
                  <p className="reasoning">{option.reasoning}</p>
                </div>
              ))}
            </div>
            <div className="poll-meta">
              <span className="confidence">
                🎯 Confidence: {(createdPoll.confidence_level * 100).toFixed(0)}%
              </span>
              <span className="timeframe">⏰ {createdPoll.resolution_timeframe}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Recent Polls Display
function RecentPolls() {
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock recent polls - this would fetch from API
    setTimeout(() => {
      setPolls([
        {
          id: '1',
          question: '🎯 Tesla Q4 earnings - record profits or guidance cut?',
          category: 'business',
          viral_score: 0.89,
          bets_count: 247,
          pool_size: '12.5K FLOW'
        },
        {
          id: '2', 
          question: '⚡ Will OpenAI release GPT-5 by March 2024?',
          category: 'tech',
          viral_score: 0.92,
          bets_count: 892,
          pool_size: '45.2K FLOW'
        },
        {
          id: '3',
          question: '🔥 Fed emergency meeting - rate shock or market calm?',
          category: 'finance',
          viral_score: 0.95,
          bets_count: 1337,
          pool_size: '78.9K FLOW'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="recent-polls loading">
        <h2>🔥 Trending Polls</h2>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="recent-polls">
      <h2>🔥 Trending AI-Generated Polls</h2>
      
      <div className="polls-list">
        {polls.map(poll => (
          <div key={poll.id} className="poll-card">
            <div className="poll-header">
              <h3 className="poll-question">{poll.question}</h3>
              <span className={`category ${poll.category}`}>{poll.category}</span>
            </div>
            
            <div className="poll-stats">
              <div className="stat">
                <span className="value">{(poll.viral_score * 100).toFixed(0)}%</span>
                <span className="label">Viral Score</span>
              </div>
              <div className="stat">
                <span className="value">{poll.bets_count}</span>
                <span className="label">Bets</span>
              </div>
              <div className="stat">
                <span className="value">{poll.pool_size}</span>
                <span className="label">Pool Size</span>
              </div>
            </div>
            
            <div className="poll-actions">
              <button className="bet-btn">Place Bet</button>
              <button className="share-btn">Share</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PolyPollApp;

// CSS Styles (would be in a separate file)
export const styles = `
.polypoll-app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-status {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}

.current-provider .provider.local {
  color: #10b981;
}

.privacy-badge {
  background: #10b981;
  color: white;
  font-size: 0.7em;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 5px;
}

.creator-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 40px;
}

.poll-creator {
  background: #f8fafc;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e2e8f0;
}

.input-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.article-input, .tweet-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}

.create-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.created-poll {
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.poll-preview .question {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.option {
  padding: 12px;
  border-radius: 8px;
  border: 2px solid;
  font-size: 14px;
}

.option.optimist { border-color: #10b981; background: #f0fdf4; }
.option.contrarian { border-color: #f59e0b; background: #fffbeb; }
.option.pessimist { border-color: #ef4444; background: #fef2f2; }
.option.hottake { border-color: #8b5cf6; background: #faf5ff; }

.binary-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.binary-option {
  padding: 16px;
  border-radius: 8px;
  border: 2px solid;
}

.binary-option.yes { border-color: #10b981; background: #f0fdf4; }
.binary-option.no { border-color: #ef4444; background: #fef2f2; }

.polls-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.poll-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.poll-stats {
  display: flex;
  gap: 24px;
  margin: 12px 0;
}

.stat {
  text-align: center;
}

.stat .value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.stat .label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 500;
}
`;