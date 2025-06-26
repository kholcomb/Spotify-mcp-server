# Contributing to Spotify MCP Server

Thank you for your interest in contributing to the Spotify MCP Server! 🎵

This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Install dependencies**: `npm install`
4. **Build the project**: `npm run build`
5. **Run tests**: `npm test`
6. **Create a branch** for your changes
7. **Make your changes** and commit
8. **Push to your fork** and create a pull request

## 📋 Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please be respectful and professional in all interactions.

### Our Standards

- **Be respectful** and inclusive
- **Be patient** with new contributors
- **Be constructive** in feedback
- **Focus on the code**, not the person
- **Help others learn** and grow

## 🛠️ Development Setup

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **Git** for version control
- **Claude Desktop** for testing

### Local Development

```bash
# Clone your fork
git clone https://github.com/your-username/spotify-mcp-server.git
cd spotify-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Get Spotify app credentials from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
3. Fill in your credentials in `.env`
4. Run `npm run setup` to configure Claude Desktop

## 🏗️ Project Structure

```
spotify-mcp-server/
├── src/                    # Source code
│   ├── auth/              # Authentication (OAuth, PKCE)
│   ├── server/            # MCP server implementation
│   ├── spotify/           # Spotify API client
│   ├── tools/             # MCP tools (21 tools)
│   ├── security/          # Security features
│   └── utils/             # Utilities and config
├── tests/                 # Test suite
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── mocks/             # Test mocks
├── docs/                  # Documentation
└── scripts/               # Build and deployment scripts
```

## 🧪 Testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Tests

- **Unit tests**: Test individual functions/classes
- **Integration tests**: Test component interactions
- **Mock external APIs**: Use provided mocks for Spotify API
- **Follow naming**: `*.test.ts` for test files
- **Test security**: Ensure sensitive data is not logged

### Test Guidelines

- Write tests for new features
- Update tests for bug fixes
- Maintain high test coverage
- Use descriptive test names
- Test error conditions
- Mock external dependencies

## 📝 Coding Standards

### TypeScript

- Use **strict TypeScript** configuration
- Define proper **interfaces and types**
- Use **async/await** over Promises
- Handle **errors explicitly**
- Add **JSDoc comments** for public APIs

### Code Style

- Use **2 spaces** for indentation
- Follow **ESLint** configuration
- Use **Prettier** for formatting
- Keep functions **small and focused**
- Use **meaningful variable names**

### Security

- **Never commit secrets** or API keys
- **Validate all inputs** from external sources
- **Use secure defaults** for configuration
- **Log security events** appropriately
- **Follow OAuth best practices**

## 🎯 Areas for Contribution

### 🐛 Bug Fixes

- Fix reported issues
- Improve error handling
- Enhance reliability
- Performance optimizations

### ✨ New Features

- Additional Spotify API endpoints
- New MCP tools
- Enhanced user experience
- Developer tooling

### 📚 Documentation

- API documentation
- Usage examples
- Troubleshooting guides
- Video tutorials

### 🧪 Testing

- Increase test coverage
- Add integration tests
- Performance testing
- Security testing

### 🔒 Security

- Security audits
- Vulnerability fixes
- Enhanced authentication
- Privacy improvements

## 🔄 Pull Request Process

### Before Submitting

1. **Check existing issues** and PRs
2. **Create an issue** for major changes
3. **Follow the coding standards**
4. **Write/update tests**
5. **Update documentation**
6. **Test your changes thoroughly**

### PR Requirements

- [ ] **Descriptive title** and description
- [ ] **Link to related issue** (if applicable)
- [ ] **Tests pass** (`npm test`)
- [ ] **Linting passes** (`npm run lint`)
- [ ] **Type checking passes** (`npm run typecheck`)
- [ ] **Documentation updated**
- [ ] **No sensitive data** committed

### Review Process

1. **Automated checks** run (tests, linting, etc.)
2. **Maintainer review** for code quality and design
3. **Security review** for security-related changes
4. **Community feedback** for significant changes
5. **Approval and merge** by maintainers

## 🏷️ Issue Labels

- **bug**: Something isn't working
- **enhancement**: New feature or request
- **documentation**: Improvements or additions to docs
- **good first issue**: Good for newcomers
- **help wanted**: Extra attention is needed
- **security**: Security-related issue
- **question**: Further information is requested

## 📦 Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Run full test suite
- [ ] Update documentation
- [ ] Create release notes
- [ ] Tag release in Git
- [ ] Publish to npm (if applicable)

## 🤝 Getting Help

### For Contributors

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Discord/Slack**: Real-time chat (if available)
- **Documentation**: Check existing docs first

### For Maintainers

- **Code reviews**: Focus on quality and security
- **Issue triage**: Label and prioritize issues
- **Release management**: Coordinate releases
- **Community**: Foster welcoming environment

## 🎉 Recognition

Contributors are recognized in:

- **README.md**: Contributors section
- **Release notes**: Notable contributions
- **GitHub**: Contributor badge
- **Special mentions**: Outstanding contributions

## 📧 Contact

- **GitHub Issues**: For bugs and features
- **GitHub Discussions**: For questions and ideas
- **Email**: [maintainer@example.com] for private matters
- **Security**: [security@example.com] for security issues

---

**Thank you for contributing to the Spotify MCP Server! 🎶**

*Together, we're making it easier for everyone to control Spotify with AI.*