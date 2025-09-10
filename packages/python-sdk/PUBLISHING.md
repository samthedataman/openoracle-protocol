# Publishing OpenOracle Python SDK to PyPI

This guide walks you through publishing the OpenOracle Python SDK to PyPI.

## Prerequisites

1. **PyPI Account**: Create accounts on both [PyPI](https://pypi.org/account/register/) and [TestPyPI](https://test.pypi.org/account/register/)

2. **API Token**: Generate API tokens for both repositories:
   - PyPI: https://pypi.org/manage/account/token/
   - TestPyPI: https://test.pypi.org/manage/account/token/

3. **Python Environment**: Ensure Python 3.9+ is installed

## Quick Start

### Method 1: Using Scripts (Recommended)

```bash
# 1. Build the package
./scripts/build.sh

# 2. Test on TestPyPI first
export PYPI_API_TOKEN="your-testpypi-token"
./scripts/publish.sh --test

# 3. Publish to production PyPI
export PYPI_API_TOKEN="your-pypi-token"
./scripts/publish.sh
```

### Method 2: Manual Steps

```bash
# Navigate to package directory
cd packages/openoracle-sdk

# Install build tools
pip install --upgrade pip build twine wheel

# Clean previous builds
rm -rf build/ dist/ *.egg-info/

# Build the package
python -m build

# Verify the package
python -m twine check dist/*

# Upload to TestPyPI (test first)
python -m twine upload --repository testpypi dist/* --username __token__ --password your-testpypi-token

# Upload to PyPI (production)
python -m twine upload dist/* --username __token__ --password your-pypi-token
```

## Detailed Steps

### 1. Pre-publication Checklist

- [ ] Update version number in `pyproject.toml` and `setup.py`
- [ ] Update `CHANGELOG.md` with new features and fixes
- [ ] Run all tests: `pytest tests/`
- [ ] Verify documentation is up to date
- [ ] Check that all imports work correctly
- [ ] Validate package metadata

### 2. Version Management

Update version in multiple places:

```toml
# pyproject.toml
[project]
version = "0.1.1"
```

```python
# setup.py
setup(
    version="0.1.1",
    # ...
)
```

```python
# openoracle/__init__.py
__version__ = "0.1.1"
```

### 3. Testing Before Publication

```bash
# Install in development mode
pip install -e .[dev]

# Run comprehensive tests
pytest tests/ -v --cov=openoracle

# Test CLI
openoracle --version
openoracle health

# Test imports
python -c "import openoracle; print(openoracle.__version__)"
```

### 4. Build Process

The build process creates two files:
- `*.tar.gz` - Source distribution
- `*.whl` - Wheel distribution

```bash
# Build both distributions
python -m build

# Verify contents
tar -tzf dist/openoracle-sdk-*.tar.gz | head -20
unzip -l dist/openoracle_sdk-*.whl | head -20
```

### 5. TestPyPI Validation

Always test on TestPyPI first:

```bash
# Upload to TestPyPI
python -m twine upload --repository testpypi dist/*

# Test installation from TestPyPI
pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ openoracle-sdk

# Test the installed package
python -c "import openoracle; print('Success!')"
```

### 6. Production Publication

```bash
# Upload to PyPI
python -m twine upload dist/*

# Verify on PyPI
open https://pypi.org/project/openoracle-sdk/

# Test installation
pip install openoracle-sdk
```

## Environment Variables

Set these environment variables for automated publishing:

```bash
# For PyPI
export PYPI_API_TOKEN="pypi-token-here"

# For TestPyPI
export TESTPYPI_API_TOKEN="testpypi-token-here"

# Alternative: username/password
export PYPI_USERNAME="your-username"
export PYPI_PASSWORD="your-password"
```

## Automation with GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to PyPI

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install build twine
    
    - name: Build package
      run: python -m build
      
    - name: Publish to PyPI
      env:
        TWINE_USERNAME: __token__
        TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
      run: twine upload dist/*
```

## Troubleshooting

### Common Issues

1. **"File already exists"**
   - Cannot upload same version twice
   - Increment version number

2. **"Invalid credentials"**
   - Check API token is correct
   - Ensure token has upload permissions

3. **"Package name taken"**
   - Choose different package name
   - Check for typos in existing names

4. **"Missing files"**
   - Ensure `MANIFEST.in` includes all necessary files
   - Check `pyproject.toml` package configuration

### Validation Commands

```bash
# Check package metadata
python -m twine check dist/*

# Verify package structure
python setup.py check --metadata --strict

# Test local installation
pip install dist/*.whl

# Check dependencies
pip-compile --dry-run requirements.txt
```

## Security Best Practices

1. **API Tokens**
   - Use API tokens instead of username/password
   - Scope tokens to upload-only permissions
   - Store tokens securely (environment variables, secrets manager)

2. **Two-Factor Authentication**
   - Enable 2FA on PyPI account
   - Use app-based authentication

3. **Package Verification**
   - Always run `twine check` before upload
   - Verify package contents match expectations
   - Test installation on clean environment

## Post-Publication

1. **Verification**
   - Check package appears on PyPI
   - Test installation: `pip install openoracle-sdk`
   - Verify documentation links work

2. **Announcements**
   - Update project documentation
   - Announce on social media/forums
   - Notify users of new version

3. **Monitoring**
   - Watch for user feedback
   - Monitor download statistics
   - Check for security alerts

## Version Strategy

Follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
- `MAJOR`: Breaking changes
- `MINOR`: New features, backward compatible
- `PATCH`: Bug fixes, backward compatible

Example progression:
- `0.1.0` - Initial release
- `0.1.1` - Bug fixes
- `0.2.0` - New features
- `1.0.0` - Production ready, stable API

## Support

- **Documentation**: https://docs.openoracle.ai
- **Issues**: https://github.com/openoracle/python-sdk/issues
- **PyPI Package**: https://pypi.org/project/openoracle-sdk/
- **Contact**: team@openoracle.ai