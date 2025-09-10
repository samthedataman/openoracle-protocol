# Contributing to OpenOracle

We love contributions! This guide will help you get started with contributing to the OpenOracle monorepo.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/openoracle.git
   cd openoracle
   ```

3. **Install dependencies**
   ```bash
   npm run install:all
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📦 Monorepo Structure

```
openoracle/
├── packages/
│   ├── python-sdk/     # Python SDK (PyPI: openoracle)
│   ├── node-sdk/       # Node.js SDK (npm: openoracle-sdk-js)  
│   └── react-sdk/      # React SDK (npm: openoracle-react-sdk)
├── docs/               # Documentation
├── examples/           # Example implementations
└── tools/             # Development tools
```

## 🛠 Development Workflow

### Python SDK
```bash
cd packages/python-sdk
pip install -e .
python -m pytest  # Run tests
```

### Node.js SDK
```bash
cd packages/node-sdk
npm install
npm run build
npm test
```

### React SDK
```bash
cd packages/react-sdk
npm install
npm run build
npm test
```

## 🧪 Testing

Run all tests:
```bash
npm run test
```

Run specific package tests:
```bash
npm run test:python
npm run test:node
npm run test:react
```

## 📝 Code Style

- **Python**: Follow PEP 8, use `black` for formatting
- **TypeScript**: Follow ESLint rules, use Prettier
- **Documentation**: Write clear docstrings and JSDoc comments

## 🔍 Linting

```bash
npm run lint          # Lint all packages
npm run lint:node     # Lint Node.js SDK
npm run lint:react    # Lint React SDK
```

## 🎯 Contribution Guidelines

### Issues
- Search existing issues before creating new ones
- Use issue templates when available
- Provide clear reproduction steps for bugs

### Pull Requests
- Write clear commit messages
- Include tests for new features
- Update documentation as needed
- Keep PRs focused and atomic

### Commit Messages
Use conventional commits:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `test:` adding tests
- `refactor:` code refactoring

Example: `feat(python): add new oracle provider support`

## 🚦 CI/CD

Our CI pipeline runs:
- ✅ Linting and type checking
- ✅ Unit and integration tests
- ✅ Security scans
- ✅ Build verification

## 💰 Monetization & Open Source

OpenOracle follows an **open core** model:
- **SDKs are 100% open source** (this repo)
- **Smart contracts handle monetization** (separate repo)
- **Premium features** via blockchain payments
- **Community-driven development**

## 📋 Release Process

1. **Create PR** with your changes
2. **Code review** by maintainers
3. **Automated testing** passes
4. **Merge to main** triggers release pipeline
5. **Packages published** to PyPI/npm automatically

## 🏆 Recognition

Contributors get:
- 🎖️ Recognition in CONTRIBUTORS.md
- 🐙 GitHub profile credit
- 🪙 Potential token airdrops (future)
- 🌟 Community shoutouts

## 📞 Getting Help

- **Discord**: [Join our community](https://discord.gg/openoracle)
- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas

## 📄 Code of Conduct

We follow the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

---

**Happy coding!** 🚀 Every contribution makes the oracle network stronger.