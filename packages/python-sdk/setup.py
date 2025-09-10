"""
Setup script for OpenOracle Python SDK
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read the contents of README file
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text() if (this_directory / "README.md").exists() else ""

# Read requirements from requirements.txt
requirements = []
requirements_file = this_directory / "requirements.txt"
if requirements_file.exists():
    requirements = requirements_file.read_text().strip().split('\n')
    requirements = [req.strip() for req in requirements if req.strip() and not req.startswith('#')]

setup(
    name="openoracle",
    version="0.1.0",
    author="OpenOracle Team",
    author_email="team@openoracle.ai",
    description="Intelligent Oracle Routing for Prediction Markets",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/openoracle/python-sdk",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Internet :: WWW/HTTP :: Dynamic Content",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.9",
    install_requires=requirements or [
        "aiohttp>=3.8.0",
        "pydantic>=2.0.0",
        "python-dotenv>=1.0.0",
        "asyncio-mqtt>=0.11.0",  # For real-time updates
        "web3>=6.0.0",  # For blockchain interactions
        "requests>=2.28.0",  # Backup sync client
        "tenacity>=8.0.0",  # Retry logic
        "cachetools>=5.0.0",  # Caching
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "isort>=5.12.0",
            "flake8>=6.0.0",
            "mypy>=1.0.0",
            "pre-commit>=3.0.0",
        ],
        "docs": [
            "sphinx>=6.0.0",
            "sphinx-rtd-theme>=1.2.0",
            "myst-parser>=1.0.0",
        ],
        "all": [
            "jupyter>=1.0.0",
            "pandas>=2.0.0",
            "plotly>=5.0.0",
            "streamlit>=1.28.0",  # For demos
        ]
    },
    entry_points={
        "console_scripts": [
            "openoracle=openoracle.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "openoracle": [
            "schemas/*.json",
            "config/*.yaml",
            "config/*.json",
        ]
    },
    keywords=[
        "oracle", "blockchain", "prediction-markets", "defi", 
        "chainlink", "pyth", "uma", "api3", "band-protocol",
        "ai", "routing", "twitter", "social-media"
    ],
    project_urls={
        "Documentation": "https://docs.openoracle.ai",
        "Source": "https://github.com/openoracle/python-sdk",
        "Tracker": "https://github.com/openoracle/python-sdk/issues",
        "Homepage": "https://openoracle.ai",
    },
)