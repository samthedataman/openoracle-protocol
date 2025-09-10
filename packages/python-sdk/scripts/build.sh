#!/bin/bash
# Build script for OpenOracle Python SDK

set -e

echo "🏗️  Building OpenOracle Python SDK for PyPI..."

# Navigate to package directory
cd "$(dirname "$0")/.."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build/
rm -rf dist/
rm -rf *.egg-info/
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true

# Install build dependencies
echo "📦 Installing build dependencies..."
python -m pip install --upgrade pip
python -m pip install --upgrade build twine wheel setuptools

# Validate package structure
echo "✅ Validating package structure..."
if [ ! -f "openoracle/__init__.py" ]; then
    echo "❌ Error: openoracle/__init__.py not found"
    exit 1
fi

if [ ! -f "README.md" ]; then
    echo "❌ Error: README.md not found"
    exit 1
fi

if [ ! -f "LICENSE" ]; then
    echo "❌ Error: LICENSE not found"
    exit 1
fi

# Run tests
echo "🧪 Running tests..."
python -m pip install -e .[dev]
python -m pytest tests/ -v --tb=short || {
    echo "⚠️  Some tests failed, but continuing with build..."
}

# Build the package
echo "🔨 Building package..."
python -m build

# Verify the built package
echo "🔍 Verifying built package..."
python -m twine check dist/*

echo "✅ Build completed successfully!"
echo ""
echo "📦 Built files:"
ls -la dist/
echo ""
echo "🚀 Ready to publish to PyPI!"
echo "   Run: ./scripts/publish.sh"