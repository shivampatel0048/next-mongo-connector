#!/bin/bash

# Build and Test Script for next-mongo-connector
# This script builds the package and runs comprehensive tests

set -e

echo "🚀 Building next-mongo-connector package..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/
rm -rf coverage/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Type checking
echo "🔍 Running TypeScript type checking..."
npm run type-check

# Build the package
echo "🔨 Building package..."
npm run build

# Check if build output exists
if [ ! -d "dist" ]; then
    echo "❌ Build failed - no dist directory found"
    exit 1
fi

echo "✅ Build completed successfully!"

# List build outputs
echo "📋 Build outputs:"
ls -la dist/

# Run linting
echo "🔍 Running ESLint..."
if command -v eslint &> /dev/null; then
    npm run lint
else
    echo "⚠️ ESLint not found, skipping linting"
fi

# Run tests
echo "🧪 Running tests..."

# Run mocked tests first
echo "Running unit tests with mocks..."
npm run test

# Run security tests
echo "Running security tests..."
npm run test:security

# Check if MONGODB_URI is set for integration tests
if [ -n "$MONGODB_URI" ]; then
    echo "🌐 MONGODB_URI found, running integration tests..."
    npm run test:integration
else
    echo "⚠️ MONGODB_URI not set, skipping integration tests"
    echo "Set MONGODB_URI environment variable to run integration tests"
fi

# Generate coverage report
echo "📊 Generating coverage report..."
npm run test:coverage

echo "✅ All tests completed successfully!"

# Package information
echo "📦 Package information:"
npm pack --dry-run

echo "🎉 Package is ready for publishing!"
echo ""
echo "📝 Next steps:"
echo "1. Review the build output in ./dist/"
echo "2. Check the coverage report in ./coverage/"
echo "3. Test the package locally: npm pack"
echo "4. Publish to npm: npm publish"
