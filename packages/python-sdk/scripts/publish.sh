#!/bin/bash
# Publish script for OpenOracle Python SDK to PyPI

set -e

echo "🚀 Publishing OpenOracle Python SDK to PyPI..."

# Navigate to package directory
cd "$(dirname "$0")/.."

# Check if dist/ exists
if [ ! -d "dist" ]; then
    echo "❌ Error: dist/ directory not found. Run ./scripts/build.sh first."
    exit 1
fi

# Check if there are files to upload
if [ ! "$(ls -A dist/)" ]; then
    echo "❌ Error: No files in dist/ directory. Run ./scripts/build.sh first."
    exit 1
fi

# Install/upgrade twine
echo "📦 Installing/upgrading twine..."
python -m pip install --upgrade twine

# Check credentials
echo "🔐 Checking PyPI credentials..."
if [ -z "$PYPI_USERNAME" ] && [ -z "$PYPI_PASSWORD" ] && [ -z "$PYPI_API_TOKEN" ]; then
    echo "⚠️  No PyPI credentials found in environment variables."
    echo "   You can set them with:"
    echo "   export PYPI_API_TOKEN='your-token'"
    echo "   OR"
    echo "   export PYPI_USERNAME='your-username'"
    echo "   export PYPI_PASSWORD='your-password'"
    echo ""
    echo "🔑 You will be prompted for credentials during upload."
fi

# Determine repository
REPOSITORY="pypi"
if [ "$1" = "--test" ] || [ "$1" = "-t" ]; then
    REPOSITORY="testpypi"
    echo "📝 Publishing to TestPyPI..."
else
    echo "📝 Publishing to PyPI..."
fi

# Verify package before upload
echo "🔍 Final package verification..."
python -m twine check dist/*

# Confirm upload
echo ""
echo "📦 About to upload the following files to $REPOSITORY:"
ls -la dist/
echo ""
read -p "❓ Continue with upload? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Upload cancelled."
    exit 1
fi

# Upload to PyPI
echo "⬆️  Uploading to $REPOSITORY..."

if [ "$REPOSITORY" = "testpypi" ]; then
    # Upload to TestPyPI
    if [ -n "$PYPI_API_TOKEN" ]; then
        python -m twine upload --repository testpypi dist/* --username __token__ --password "$PYPI_API_TOKEN"
    else
        python -m twine upload --repository testpypi dist/*
    fi
    echo "✅ Successfully uploaded to TestPyPI!"
    echo "🔗 View at: https://test.pypi.org/project/openoracle-sdk/"
    echo ""
    echo "🧪 Test installation with:"
    echo "   pip install --index-url https://test.pypi.org/simple/ openoracle-sdk"
else
    # Upload to PyPI
    if [ -n "$PYPI_API_TOKEN" ]; then
        python -m twine upload dist/* --username __token__ --password "$PYPI_API_TOKEN"
    else
        python -m twine upload dist/*
    fi
    echo "✅ Successfully uploaded to PyPI!"
    echo "🔗 View at: https://pypi.org/project/openoracle-sdk/"
    echo ""
    echo "📥 Install with:"
    echo "   pip install openoracle-sdk"
fi

echo ""
echo "🎉 Publication completed successfully!"