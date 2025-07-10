# Next MongoDB Connector

🚀 **A production-ready, secure MongoDB connector for serverless Next.js applications**

[![npm version](https://badge.fury.io/js/next-mongo-connector.svg)](https://badge.fury.io/js/next-mongo-connector)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, secure MongoDB connector library designed specifically for serverless Next.js environments (Vercel, AWS Lambda, etc.). Features intelligent connection caching, enterprise-grade security, full TypeScript support, and protection against common database vulnerabilities.

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚦 Quick Start](#-quick-start)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
  - [Next.js Configuration](#nextjs-configuration)
  - [Basic Usage](#basic-usage)
- [🎯 Advanced Usage](#-advanced-usage)
  - [With Mongoose Models](#with-mongoose-models)
  - [Advanced Connection Verification](#advanced-connection-verification)
  - [With Connection Callbacks](#with-connection-callbacks)
  - [Multi-Database Support](#multi-database-support)
  - [Security Configuration](#security-configuration)
  - [Health Monitoring](#health-monitoring)
  - [Graceful Shutdown](#graceful-shutdown)
- [🛡️ Security Features](#️-security-features)
  - [URI Validation](#uri-validation)
  - [Connection Security](#connection-security)
  - [Input Validation](#input-validation)
- [📊 API Reference](#-api-reference)
  - [Core Functions](#core-functions)
  - [Monitoring Functions](#monitoring-functions)
  - [Management Functions](#management-functions)
  - [Security Functions](#security-functions)
- [🔧 Configuration Options](#-configuration-options)
  - [MongoConnectionOptions](#mongoconnectionoptions)
  - [Environment Variables](#environment-variables)
- [🧪 Testing](#-testing)
  - [Test Categories](#test-categories)
  - [Running Tests](#running-tests)
  - [Test Suite Features](#test-suite-features)
- [🔧 Optional Dependencies](#-optional-dependencies)
  - [Simple Configuration](#simple-configuration)
  - [Custom Configuration](#custom-configuration)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)
- [🔗 Links](#-links)
- [🙏 Acknowledgments](#-acknowledgments)

## ✨ Features

- 🔒 **Enterprise-grade Security** - Anti-hijacking, injection prevention, SSL/TLS enforcement
- ⚡ **Smart Connection Caching** - Prevents connection storms in serverless environments
- 🛡️ **Lambda-Safe** - Optimized for serverless functions with graceful shutdown handling
- 📝 **TypeScript First** - Full type safety with comprehensive `.d.ts` files
- 🔄 **Auto-Retry Logic** - Configurable retry mechanisms with exponential backoff
- 🌐 **Multi-Database Support** - Handle multiple database connections simultaneously
- 📊 **Health Monitoring** - Built-in health checks and connection pool statistics
- 🎯 **Next.js Optimized** - Works seamlessly with both Pages and App Router
- 🚫 **Zero Dependencies** - Only peer dependency on Mongoose
- ⚙️ **Environment Validation** - Automatic URI validation and security checking
- 🔍 **Advanced Connection Verification** - Detailed connection status checking
- 🛠️ **Model Management** - Smart model compilation and caching
- 🧪 **Comprehensive Testing** - Full test suite with real database operations

## 🚦 Quick Start

### Installation

```bash
npm install next-mongo-connector mongoose
# or
yarn add next-mongo-connector mongoose
# or
pnpm add next-mongo-connector mongoose
```

### Environment Setup

```bash
# .env.local
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### Next.js Configuration

Create or update your `next.config.js` (or `next.config.ts`):

```typescript
import { createNextConfig } from "next-mongo-connector";

// The createNextConfig function handles all MongoDB-related
// webpack configuration automatically
const config = createNextConfig({
  // Your other Next.js config options
  reactStrictMode: true,
  poweredByHeader: false,
});

export default config;
```

This configuration automatically handles:

- Native MongoDB dependencies (kerberos, bson-ext, etc.)
- Binary module loading (.node files)
- Optional dependency resolution
- Webpack warning suppression

### Basic Usage

```typescript
import { connectMongo, getDb } from "next-mongo-connector";

// API Route (Pages Router)
export default async function handler(req, res) {
  try {
    // Connect to MongoDB (cached automatically)
    await connectMongo();

    // Get database instance
    const db = getDb();

    // Use the database
    const users = await db.collection("users").find({}).toArray();

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
}
```

```typescript
// App Router (app/api/users/route.ts)
import { connectMongo, getDb } from "next-mongo-connector";

export async function GET() {
  try {
    await connectMongo();
    const db = getDb();

    const users = await db.collection("users").find({}).toArray();

    return Response.json({ users });
  } catch (error) {
    return Response.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }
}
```

## 🎯 Advanced Usage

### With Mongoose Models

```typescript
import { connectMongo, getConnection } from "next-mongo-connector";
import { Schema } from "mongoose";

// Define your schema
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

export default async function handler(req, res) {
  try {
    // Connect and get the connection instance
    const connection = await connectMongo();

    // Create or get the model (smart model management)
    const User = connection.models.User || connection.model("User", userSchema);

    // Use Mongoose methods
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com",
    });

    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Advanced Connection Verification

```typescript
import {
  connectMongo,
  isConnectedWithVerification,
  getConnectionInfo,
} from "next-mongo-connector";

export default async function handler(req, res) {
  try {
    await connectMongo();

    // Get detailed connection verification
    const verification = await isConnectedWithVerification();

    // Get connection information
    const info = getConnectionInfo();

    res.status(200).json({
      verification: {
        isConnected: verification.isConnected,
        readyState: verification.readyState,
        connectionState: verification.connectionState,
        details: verification.details,
      },
      connection: {
        state: info?.state,
        database: info?.database,
        host: info?.host,
        connectedAt: info?.connectedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Connection verification failed" });
  }
}
```

### With Connection Callbacks

```typescript
import { connectMongo } from "next-mongo-connector";

await connectMongo(
  process.env.MONGODB_URI,
  {
    debug: true,
    maxRetries: 3,
    retryDelay: 2000,
    allowedHosts: ["*.mongodb.net", "localhost"],
  },
  // onConnect callback
  async (connection, info) => {
    console.log(`✅ Connected to ${info.database} at ${info.host}`);
    console.log(
      `🔗 Connection established in ${
        Date.now() - info.connectedAt!.getTime()
      }ms`
    );
  },
  // onDisconnect callback
  async (info) => {
    console.log(`❌ Disconnected from ${info.connectionName}`);
  },
  // onError callback
  async (error, info) => {
    console.error(`🚨 Connection error on ${info.connectionName}:`, error);
  }
);
```

### Multi-Database Support

```typescript
import { connectMongo, getDb, isConnected } from "next-mongo-connector";

// Connect to multiple databases
await connectMongo(process.env.MAIN_DB_URI, {
  connectionName: "main",
});

await connectMongo(process.env.ANALYTICS_DB_URI, {
  connectionName: "analytics",
});

// Use different databases
const mainDb = getDb("main");
const analyticsDb = getDb("analytics");

const users = await mainDb.collection("users").find({}).toArray();
const events = await analyticsDb.collection("events").find({}).toArray();

// Check connection status
console.log("Main DB connected:", isConnected("main"));
console.log("Analytics DB connected:", isConnected("analytics"));
```

### Security Configuration

```typescript
import { connectMongo, validateURI } from "next-mongo-connector";

// Validate URI before connecting
const validation = validateURI(process.env.MONGODB_URI!, ["*.mongodb.net"]);
if (!validation.isValid) {
  throw new Error(`Invalid URI: ${validation.errors.join(", ")}`);
}

// Connect with security options
await connectMongo(process.env.MONGODB_URI, {
  options: {
    ssl: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
  },
  allowedHosts: ["*.mongodb.net", "trusted-host.com"],
  validateSSL: true,
});
```

### Health Monitoring

```typescript
import {
  connectMongo,
  healthCheck,
  getPoolStats,
  getConnectionInfo,
} from "next-mongo-connector";

export default async function handler(req, res) {
  try {
    await connectMongo();

    // Perform health check
    const health = await healthCheck();

    // Get pool statistics
    const stats = getPoolStats();

    // Get connection information
    const info = getConnectionInfo();

    res.status(200).json({
      health: {
        isHealthy: health.isHealthy,
        latency: health.latency,
        lastPing: health.lastPing,
        error: health.error,
      },
      pool: {
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        pendingConnections: stats.pendingConnections,
        failedConnections: stats.failedConnections,
        connectionNames: stats.connectionNames,
      },
      connection: {
        state: info?.state,
        database: info?.database,
        host: info?.host,
        connectedAt: info?.connectedAt,
        retryCount: info?.retryCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Health check failed" });
  }
}
```

### Graceful Shutdown

```typescript
import { closeAllConnections } from "next-mongo-connector";

// Automatic shutdown handling is built-in, but you can also manually close connections
process.on("SIGTERM", async () => {
  console.log("🔄 Gracefully shutting down...");
  await closeAllConnections();
  process.exit(0);
});
```

## 🛡️ Security Features

### URI Validation

- Protocol validation (only `mongodb://` and `mongodb+srv://`)
- Host whitelist support with wildcard patterns (`*.mongodb.net`)
- Malicious URI detection (prevents `javascript:`, `data:` schemes)
- Credential exposure warnings
- Comprehensive error messages with available connections

### Connection Security

- Enforced SSL/TLS in production environments
- Certificate validation
- Hostname verification
- Protection against connection hijacking
- Connection state verification

### Input Validation

- Buffer size limits to prevent memory exhaustion
- Connection pool size validation
- Parameter sanitization
- Model compilation safety

## 📊 API Reference

### Core Functions

#### `connectMongo(uri?, options?, onConnect?, onDisconnect?, onError?)`

Establishes a cached MongoDB connection with improved error handling.

**Parameters:**

- `uri` (string, optional): MongoDB URI (uses `MONGODB_URI` env var if not provided)
- `options` (MongoConnectionOptions, optional): Connection configuration
- `onConnect` (function, optional): Callback executed on successful connection
- `onDisconnect` (function, optional): Callback executed on disconnection
- `onError` (function, optional): Callback executed on connection errors

**Returns:** `Promise<mongoose.Connection>`

#### `getDb(connectionName?)`

Gets the database instance from an active connection.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `mongoose.Connection['db']`

#### `getConnection(connectionName?)`

Gets the Mongoose connection instance.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `mongoose.Connection`

#### `isConnected(connectionName?)`

Checks if a connection is active with improved verification.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `boolean`

#### `isConnectedWithVerification(connectionName?)`

Gets detailed connection status with verification information.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `Promise<{isConnected: boolean, readyState: number, connectionState: string, details: object}>`

### Monitoring Functions

#### `healthCheck(connectionName?)`

Performs a health check on the connection with detailed error messages.

**Returns:** `Promise<HealthCheck>`

#### `getPoolStats()`

Gets connection pool statistics.

**Returns:** `PoolStats`

#### `getConnectionInfo(connectionName?)`

Gets detailed connection information.

**Returns:** `ConnectionInfo | null`

### Management Functions

#### `closeConnection(connectionName?)`

Closes a specific connection.

#### `closeAllConnections()`

Closes all active connections.

### Security Functions

#### `validateURI(uri, allowedHosts?)`

Validates a MongoDB URI for security issues with comprehensive error reporting.

#### `validateOptions(options)`

Validates connection options for security compliance.

## 🔧 Configuration Options

### MongoConnectionOptions

```typescript
interface MongoConnectionOptions {
  options?: mongoose.ConnectOptions; // Mongoose connection options
  dbName?: string; // Database name override
  debug?: boolean; // Enable debug logging
  connectionTimeout?: number; // Connection timeout (ms)
  maxRetries?: number; // Maximum retry attempts
  retryDelay?: number; // Delay between retries (ms)
  validateSSL?: boolean; // Enable SSL validation
  allowedHosts?: string[]; // Whitelist of allowed hosts
  connectionName?: string; // Custom connection identifier
}
```

### Environment Variables

- `MONGODB_URI` or `MONGO_URI`: MongoDB connection string
- `NODE_ENV`: Environment mode (affects security defaults)

## 🧪 Testing

The package includes a comprehensive test suite that validates all functionality:

### Test Categories

- **Connection Tests**: Basic connection, health checks, multi-connection
- **Security Tests**: URI validation, host whitelisting, SSL enforcement
- **Database Operations**: CRUD operations, aggregation, model management
- **Error Handling**: Connection failures, validation errors, timeouts

### Running Tests

```bash
# Run mocked tests
npm test

# Run integration tests (requires MongoDB)
MONGODB_URI=your_test_db_uri npm run test:integration

# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage
```

### Test Suite Features

- Real database operations with sample data
- Model compilation safety testing
- Connection state verification
- Security validation testing
- Performance and reliability testing

## 🔧 Optional Dependencies

The package automatically handles optional MongoDB dependencies in Next.js:

- `kerberos` - For GSSAPI authentication
- `aws4` - For AWS IAM authentication
- `mongodb-client-encryption` - For client-side field level encryption
- `saslprep` - For SCRAM authentication
- `snappy` - For snappy compression
- `bson-ext` - For better BSON serialization performance
- `@mongodb-js/zstd` - For zstd compression

You don't need to install these dependencies unless you specifically need their features. The package provides empty implementations that gracefully handle their absence.

### Simple Configuration

The default configuration in `next.config.js` handles everything automatically:

```typescript
import { createNextConfig } from "next-mongo-connector";

export default createNextConfig();
```

### Custom Configuration

For advanced cases, you can customize the webpack configuration:

```typescript
import { createNextConfig } from "next-mongo-connector";

export default createNextConfig({
  webpack: (config, { isServer }) => {
    // Add your custom webpack configuration here
    return config;
  },
  // Other Next.js config options
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/next-mongo-connector)
- [GitHub Repository](https://github.com/shivampatel0048/next-mongo-connector)
- [Issue Tracker](https://github.com/shivampatel0048/next-mongo-connector/issues)
- [Documentation](https://github.com/shivampatel0048/next-mongo-connector#readme)
- [API Reference](API.md)
- [Usage Examples](EXAMPLES.md)
- [Security Policy](SECURITY.md)
- [Contributing Guide](CONTRIBUTING.md)

## 🙏 Acknowledgments

- Built with [Mongoose](https://mongoosejs.com/)
- Inspired by the Next.js community
- Security best practices from OWASP

---

**Made with ❤️ for the Next.js community**
