"""
Command-line interface for OpenOracle SDK
"""

import asyncio
import json
import sys
from typing import Optional
import argparse
from pathlib import Path

from . import OpenOracleAPI, OracleConfig, get_version


async def route_question(args):
    """Route a question to the best oracle"""
    async with OpenOracleAPI() as api:
        try:
            routing = await api.route_question(
                question=args.question,
                category_hint=args.category,
                max_cost_usd=args.max_cost,
                max_latency_ms=args.max_latency
            )
            
            result = {
                "can_resolve": routing.can_resolve,
                "selected_oracle": routing.selected_oracle.value if routing.selected_oracle else None,
                "reasoning": routing.reasoning,
                "confidence_score": routing.confidence_score,
                "estimated_cost_usd": str(routing.estimated_cost_usd) if routing.estimated_cost_usd else None,
                "estimated_latency_ms": routing.estimated_latency_ms
            }
            
            if args.output == "json":
                print(json.dumps(result, indent=2))
            else:
                print(f"Question: {args.question}")
                print(f"Can Resolve: {result['can_resolve']}")
                if result['can_resolve']:
                    print(f"Selected Oracle: {result['selected_oracle']}")
                    print(f"Confidence: {result['confidence_score']:.2f}")
                    print(f"Reasoning: {result['reasoning']}")
                    if result['estimated_cost_usd']:
                        print(f"Estimated Cost: ${result['estimated_cost_usd']}")
                    if result['estimated_latency_ms']:
                        print(f"Estimated Latency: {result['estimated_latency_ms']}ms")
                else:
                    print(f"Reason: {result['reasoning']}")
                    
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


async def get_price(args):
    """Get price for an asset"""
    async with OpenOracleAPI() as api:
        try:
            price = await api.get_price(
                asset=args.asset,
                provider=args.provider,
                chain=args.chain
            )
            
            if args.output == "json":
                print(json.dumps({
                    "asset": args.asset,
                    "price": str(price.price) if hasattr(price, 'price') else str(price.aggregated_price),
                    "provider": price.provider if hasattr(price, 'provider') else "aggregated",
                    "timestamp": price.timestamp
                }, indent=2))
            else:
                price_value = price.price if hasattr(price, 'price') else price.aggregated_price
                print(f"{args.asset}: ${price_value}")
                
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


async def analyze_tweet(args):
    """Analyze a tweet for prediction market potential"""
    async with OpenOracleAPI() as api:
        try:
            analysis = await api.analyze_tweet(args.tweet)
            
            if args.output == "json":
                print(json.dumps(analysis, indent=2))
            else:
                print(f"Tweet: {args.tweet}")
                print(f"Has Prediction: {analysis.get('has_prediction', False)}")
                if analysis.get('suggested_question'):
                    print(f"Suggested Question: {analysis['suggested_question']}")
                if analysis.get('category'):
                    print(f"Category: {analysis['category']}")
                if analysis.get('confidence'):
                    print(f"Confidence: {analysis['confidence']:.2f}")
                    
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


async def health_check(args):
    """Check system health"""
    async with OpenOracleAPI() as api:
        try:
            health = await api.health_check()
            
            if args.output == "json":
                print(json.dumps(health, indent=2))
            else:
                print(f"Overall Status: {health['status']}")
                if 'oracle_providers' in health:
                    print("\nOracle Providers:")
                    for provider, status in health['oracle_providers'].items():
                        print(f"  {provider}: {status.get('status', 'unknown')}")
                        
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


def create_config(args):
    """Create a configuration file"""
    config = OracleConfig()
    
    if args.api_key:
        config.api_key = args.api_key
    if args.base_url:
        config.base_url = args.base_url
    if args.ai_key:
        config.openrouter_api_key = args.ai_key
    
    config_path = Path(args.output_file)
    config.save_to_file(str(config_path))
    
    print(f"Configuration saved to {config_path}")
    print("Edit the file to customize provider settings and API keys.")


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="OpenOracle SDK Command Line Interface",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  openoracle route "Will BTC hit $100k in 2024?"
  openoracle price BTC/USD
  openoracle price ETH/USD --provider chainlink
  openoracle tweet "I predict Tesla will hit $300 by Q2"
  openoracle health
  openoracle config --api-key YOUR_KEY --output config.json
        """
    )
    
    parser.add_argument("--version", action="version", version=f"OpenOracle SDK {get_version()}")
    parser.add_argument("--output", choices=["text", "json"], default="text", 
                       help="Output format")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Route command
    route_parser = subparsers.add_parser("route", help="Route a question to the best oracle")
    route_parser.add_argument("question", help="Question to route")
    route_parser.add_argument("--category", help="Data category hint")
    route_parser.add_argument("--max-cost", type=float, help="Maximum cost in USD")
    route_parser.add_argument("--max-latency", type=int, help="Maximum latency in ms")
    route_parser.set_defaults(func=route_question)
    
    # Price command
    price_parser = subparsers.add_parser("price", help="Get asset price")
    price_parser.add_argument("asset", help="Asset pair (e.g., BTC/USD)")
    price_parser.add_argument("--provider", help="Specific oracle provider")
    price_parser.add_argument("--chain", help="Blockchain network")
    price_parser.set_defaults(func=get_price)
    
    # Tweet command
    tweet_parser = subparsers.add_parser("tweet", help="Analyze tweet for predictions")
    tweet_parser.add_argument("tweet", help="Tweet content to analyze")
    tweet_parser.set_defaults(func=analyze_tweet)
    
    # Health command
    health_parser = subparsers.add_parser("health", help="Check system health")
    health_parser.set_defaults(func=health_check)
    
    # Config command
    config_parser = subparsers.add_parser("config", help="Create configuration file")
    config_parser.add_argument("--api-key", help="OpenOracle API key")
    config_parser.add_argument("--base-url", help="Base API URL")
    config_parser.add_argument("--ai-key", help="OpenRouter/OpenAI API key")
    config_parser.add_argument("--output-file", default="openoracle-config.json",
                              help="Output configuration file")
    config_parser.set_defaults(func=create_config)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Handle sync vs async commands
    if args.command == "config":
        args.func(args)
    else:
        try:
            asyncio.run(args.func(args))
        except KeyboardInterrupt:
            print("\nOperation cancelled by user", file=sys.stderr)
            sys.exit(130)
        except Exception as e:
            print(f"Unexpected error: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()