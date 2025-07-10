# Contributing to Next MongoDB Connector

Thank you for your interest in contributing to Next MongoDB Connector! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Types of Contributions

We welcome contributions in the following areas:

- 🐛 **Bug Reports** - Help us identify and fix issues
- ✨ **Feature Requests** - Suggest new features and improvements
- 📚 **Documentation** - Improve docs, add examples, fix typos
- 🧪 **Tests** - Add test coverage, improve existing tests
- 🔧 **Code** - Fix bugs, implement features, improve performance
- 🎨 **Design** - Improve UX, accessibility, visual design

### Before You Start

1. **Check existing issues** - Your idea might already be discussed
2. **Read the documentation** - Understand the current implementation
3. **Set up development environment** - Follow the setup guide below

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Git
- MongoDB (for integration tests)

### Local Development

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/next-mongo-connector.git
   cd next-mongo-connector
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   # Create .env.local for testing
   cp .env.example .env.local
   # Edit .env.local with your MongoDB URI
   ```

4. **Run tests to verify setup**
   ```bash
   npm test
   npm run test:integration
   ```

### Project Structure

```
next-mongo-connector/
├── src/
│   ├── index.ts              # Main exports
│   ├── connector.ts          # Core connection logic
│   ├── types.ts              # TypeScript definitions
│   └── __tests__/            # Test files
├── scripts/                  # Build and test scripts
└── package.json
```

## 📝 Development Guidelines

### Code Style

- **TypeScript** - All code must be written in TypeScript
- **ESLint** - Follow the project's ESLint configuration
- **Prettier** - Code formatting is handled by Prettier
- **Comments** - Add JSDoc comments for public APIs

### Testing

- **Unit Tests** - Test individual functions and components
- **Integration Tests** - Test with real MongoDB connections
- **Security Tests** - Test security features and validations
- **Coverage** - Maintain high test coverage (>90%)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(security): add URI validation for malicious schemes
fix(connection): resolve timeout issues in serverless environments
docs(readme): add troubleshooting section
test(integration): add health check tests
```

### Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write code following the style guidelines
   - Add tests for new functionality
   - Update documentation if needed

3. **Run tests**

   ```bash
   npm test
   npm run test:integration
   npm run build
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat(scope): your descriptive message"
   ```

5. **Push and create PR**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Submit Pull Request**
   - Use the PR template
   - Describe your changes clearly
   - Link related issues
   - Request reviews from maintainers

## 🧪 Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run integration tests (requires MongoDB)
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/security.test.ts

# Run tests in watch mode
npm test -- --watch
```

### Writing Tests

- **Test Structure** - Use describe/it blocks with clear descriptions
- **Async Testing** - Properly handle async operations
- **Mocking** - Mock external dependencies when appropriate
- **Cleanup** - Clean up connections and state after tests

### Test Examples

```typescript
describe("Security Features", () => {
  it("should validate URI for malicious schemes", () => {
    const validation = validateURI('javascript:alert("xss")');
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain("Malicious URI scheme detected");
  });

  it("should handle connection timeouts gracefully", async () => {
    await expect(
      connectMongo("mongodb://invalid-host:27017/test", {
        connectionTimeout: 1000,
      })
    ).rejects.toThrow();
  });
});
```

## 🔒 Security Guidelines

### Security Considerations

- **Input Validation** - Always validate user inputs
- **URI Security** - Prevent injection attacks through URIs
- **Connection Security** - Enforce SSL/TLS in production
- **Error Handling** - Don't expose sensitive information in errors

### Security Testing

```typescript
describe("Security Validation", () => {
  it("should prevent SQL injection attempts", () => {
    const maliciousUri = "mongodb://host:27017/db?$where=function(){}";
    const validation = validateURI(maliciousUri);
    expect(validation.isValid).toBe(false);
  });
});
```

## 📚 Documentation Guidelines

### Documentation Standards

- **Clear Examples** - Provide working code examples
- **TypeScript** - Include proper type annotations
- **Use Cases** - Show real-world usage scenarios
- **Troubleshooting** - Include common issues and solutions

### Documentation Structure

```
docs/
├── README.md              # Main documentation
├── API.md                 # API reference
├── SECURITY.md            # Security guide
├── EXAMPLES.md            # Usage examples
└── CONTRIBUTING.md        # This file
```

## 🚀 Release Process

### Version Management

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Release notes prepared
- [ ] npm package published

## 🤝 Community Guidelines

### Code of Conduct

- **Be Respectful** - Treat everyone with respect
- **Be Inclusive** - Welcome contributors from all backgrounds
- **Be Constructive** - Provide helpful feedback
- **Be Patient** - Maintainers are volunteers

### Communication

- **GitHub Issues** - For bug reports and feature requests
- **GitHub Discussions** - For questions and general discussion
- **Pull Requests** - For code contributions
- **Email** - For security issues (see SECURITY.md)

## 🎯 Areas for Contribution

### High Priority

- 🔒 **Security Enhancements** - Additional security validations
- ⚡ **Performance Improvements** - Connection pooling optimizations
- 🧪 **Test Coverage** - More comprehensive test suites
- 📚 **Documentation** - Better examples and guides

### Medium Priority

- 🌐 **Multi-Database Features** - Enhanced multi-DB support
- 📊 **Monitoring** - Advanced health monitoring features
- 🔧 **Configuration** - More configuration options
- 🎨 **Developer Experience** - Better error messages and debugging

### Low Priority

- 🎨 **UI Components** - React components for database management
- 🔌 **Plugins** - Plugin system for extensions
- 📱 **Mobile Support** - React Native compatibility
- 🌍 **Internationalization** - Multi-language support

## 📞 Getting Help

### Resources

- **Documentation** - Check the README and docs folder
- **Issues** - Search existing issues for solutions
- **Discussions** - Ask questions in GitHub Discussions
- **Code** - Review the source code for examples

### Contact

- **Maintainers** - @shivampatel0048
- **Issues** - [GitHub Issues](https://github.com/shivampatel0048/next-mongo-connector/issues)
- **Discussions** - [GitHub Discussions](https://github.com/shivampatel0048/next-mongo-connector/discussions)

## 🙏 Acknowledgments

Thank you to all contributors who have helped make Next MongoDB Connector better! Your contributions are greatly appreciated.

---

**Happy Contributing! 🚀**
