# API Reference

This document provides a comprehensive reference for all exported functions, types, and interfaces in Next MongoDB Connector.

## 📦 Exports

### Core Functions

#### `connectMongo(uri?, options?, onConnect?, onDisconnect?, onError?)`

Establishes a cached MongoDB connection.

**Parameters:**

- `uri` (string, optional): MongoDB URI (uses `MONGODB_URI` env var if not provided)
- `options` (MongoConnectionOptions, optional): Connection configuration
- `onConnect` (OnConnectCallback, optional): Callback executed on successful connection
- `onDisconnect` (OnDisconnectCallback, optional): Callback executed on disconnection
- `onError` (OnErrorCallback, optional): Callback executed on connection errors

**Returns:** `Promise<mongoose.Connection>`

**Example:**

```typescript
import { connectMongo } from "next-mongo-connector";

const connection = await connectMongo(
  "mongodb://localhost:27017/myapp",
  { connectionName: "main" },
  (conn, info) => console.log("Connected:", info.host),
  (info) => console.log("Disconnected:", info.connectionName),
  (error, info) => console.error("Error:", error.message)
);
```

#### `waitForConnection(connectionName?, timeoutMs?)`

Waits for a connection to be fully established.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')
- `timeoutMs` (number, optional): Timeout in milliseconds (default: 10000)

**Returns:** `Promise<mongoose.Connection>`

**Example:**

```typescript
import { waitForConnection } from "next-mongo-connector";

await connectMongo();
await waitForConnection(); // Wait for default connection
await waitForConnection("my-connection", 15000); // Custom timeout
```

#### `getDb(connectionName?)`

Gets the database instance from an active connection.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `mongoose.Connection['db']`

**Throws:** `Error` if connection is not ready or not found

**Example:**

```typescript
import { getDb } from "next-mongo-connector";

const db = getDb(); // Default connection
const analyticsDb = getDb("analytics"); // Named connection

const users = await db.collection("users").find({}).toArray();
```

#### `getConnection(connectionName?)`

Gets the Mongoose connection instance.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `mongoose.Connection`

**Throws:** `Error` if connection not found

**Example:**

```typescript
import { getConnection } from "next-mongo-connector";

const connection = getConnection();
const User = connection.model("User", userSchema);
```

#### `isConnected(connectionName?)`

Checks if a connection is active.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `boolean`

**Example:**

```typescript
import { isConnected } from "next-mongo-connector";

if (isConnected()) {
  console.log("Database is connected");
}

if (isConnected("analytics")) {
  console.log("Analytics DB is connected");
}
```

#### `getConnectionInfo(connectionName?)`

Gets detailed connection information.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `ConnectionInfo | null`

**Example:**

```typescript
import { getConnectionInfo, ConnectionState } from "next-mongo-connector";

const info = getConnectionInfo();
console.log("State:", info?.state); // ConnectionState.CONNECTED
console.log("Host:", info?.host);
console.log("Database:", info?.database);
console.log("Connected at:", info?.connectedAt);
```

### Multi-Database Functions

#### `connectMultiDb(connections)`

Connects to multiple databases simultaneously.

**Parameters:**

- `connections` (MultiDbConnection[]): Array of connection configurations

**Returns:** `Promise<Map<string, mongoose.Connection>>`

**Example:**

```typescript
import { connectMultiDb } from "next-mongo-connector";

const connections = [
  {
    uri: process.env.MAIN_DB_URI,
    name: "main",
    options: { connectionName: "main" },
  },
  {
    uri: process.env.ANALYTICS_DB_URI,
    name: "analytics",
    options: { connectionName: "analytics" },
  },
];

const connectionMap = await connectMultiDb(connections);
```

#### `getAllConnectionsInfo()`

Gets information about all active connections.

**Returns:** `Map<string, ConnectionInfo>`

**Example:**

```typescript
import { getAllConnectionsInfo } from "next-mongo-connector";

const allInfo = getAllConnectionsInfo();
allInfo.forEach((info, name) => {
  console.log(`${name}: ${info.state} at ${info.host}`);
});
```

### Health Monitoring Functions

#### `healthCheck(connectionName?)`

Performs a health check on the connection.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `Promise<HealthCheck>`

**Example:**

```typescript
import { healthCheck } from "next-mongo-connector";

const health = await healthCheck();
console.log("Healthy:", health.isHealthy);
console.log("Latency:", health.latency, "ms");
console.log("Last ping:", health.lastPing);
```

#### `batchHealthCheck()`

Performs health checks on all connections.

**Returns:** `Promise<Map<string, HealthCheck>>`

**Example:**

```typescript
import { batchHealthCheck } from "next-mongo-connector";

const allHealth = await batchHealthCheck();
allHealth.forEach((health, name) => {
  console.log(`${name}: ${health.isHealthy ? "✅" : "❌"}`);
});
```

#### `getPoolStats()`

Gets connection pool statistics.

**Returns:** `PoolStats`

**Example:**

```typescript
import { getPoolStats } from "next-mongo-connector";

const stats = getPoolStats();
console.log("Total connections:", stats.totalConnections);
console.log("Active connections:", stats.activeConnections);
console.log("Connection names:", stats.connectionNames);
```

#### `startConnectionMonitoring(intervalMs?, onHealthChange?)`

Starts real-time connection monitoring.

**Parameters:**

- `intervalMs` (number, optional): Monitoring interval in milliseconds (default: 30000)
- `onHealthChange` (function, optional): Callback for health changes

**Returns:** `NodeJS.Timeout`

**Example:**

```typescript
import { startConnectionMonitoring } from "next-mongo-connector";

const timer = startConnectionMonitoring(
  30000, // Check every 30 seconds
  (connectionName, isHealthy) => {
    console.log(`${connectionName}: ${isHealthy ? "✅" : "❌"}`);
  }
);

// Stop monitoring
clearTimeout(timer);
```

### Security Functions

#### `validateURI(uri, allowedHosts?)`

Validates a MongoDB URI for security issues.

**Parameters:**

- `uri` (string): MongoDB URI to validate
- `allowedHosts` (string[], optional): List of allowed hosts with wildcard support

**Returns:** `SecurityValidation`

**Example:**

```typescript
import { validateURI } from "next-mongo-connector";

const validation = validateURI(process.env.MONGODB_URI!, [
  "*.mongodb.net",
  "localhost",
]);

if (!validation.isValid) {
  console.error("Invalid URI:", validation.errors);
} else {
  console.log("URI is valid");
  if (validation.warnings.length > 0) {
    console.warn("Warnings:", validation.warnings);
  }
}
```

#### `validateOptions(options)`

Validates connection options for security compliance.

**Parameters:**

- `options` (mongoose.ConnectOptions): Connection options to validate

**Returns:** `SecurityValidation`

**Example:**

```typescript
import { validateOptions } from "next-mongo-connector";

const options = {
  ssl: true,
  tls: true,
  maxPoolSize: 10,
};

const validation = validateOptions(options);
if (!validation.isValid) {
  console.error("Invalid options:", validation.errors);
}
```

### Utility Functions

#### `getMongoUri(fallbackUri?)`

Gets MongoDB URI from environment with validation.

**Parameters:**

- `fallbackUri` (string, optional): Fallback URI if environment variable not set

**Returns:** `string`

**Example:**

```typescript
import { getMongoUri } from "next-mongo-connector";

const uri = getMongoUri("mongodb://localhost:27017/fallback");
```

#### `quickConnect(connectionName?, options?)`

Quick connect with minimal configuration.

**Parameters:**

- `connectionName` (string, optional): Name of the connection
- `options` (QuickConnectOptions, optional): Quick connect options

**Returns:** `Promise<mongoose.Connection>`

**Example:**

```typescript
import { quickConnect } from "next-mongo-connector";

const connection = await quickConnect("quick-test", {
  debug: true,
});
```

#### `getConnectionWithTimeout(connectionName?, timeoutMs?)`

Gets connection with timeout.

**Parameters:**

- `connectionName` (string, optional): Name of the connection
- `timeoutMs` (number, optional): Timeout in milliseconds

**Returns:** `Promise<mongoose.Connection>`

**Example:**

```typescript
import { getConnectionWithTimeout } from "next-mongo-connector";

const connection = await getConnectionWithTimeout("main", 5000);
```

### Cleanup Functions

#### `closeConnection(connectionName?)`

Closes a specific connection.

**Parameters:**

- `connectionName` (string, optional): Name of the connection (default: 'default')

**Returns:** `Promise<void>`

**Example:**

```typescript
import { closeConnection } from "next-mongo-connector";

await closeConnection("analytics");
```

#### `closeAllConnections()`

Closes all active connections.

**Returns:** `Promise<void>`

**Example:**

```typescript
import { closeAllConnections } from "next-mongo-connector";

await closeAllConnections();
```

#### `cleanup()`

Comprehensive cleanup of all connections and resources.

**Returns:** `Promise<void>`

**Example:**

```typescript
import { cleanup } from "next-mongo-connector";

await cleanup();
```

#### `resetConnectorState()`

Resets connector state (useful for testing).

**Returns:** `void`

**Example:**

```typescript
import { resetConnectorState } from "next-mongo-connector";

beforeEach(() => {
  resetConnectorState();
});
```

## 📋 Types and Interfaces

### MongoConnectionOptions

```typescript
interface MongoConnectionOptions {
  /** Connection options passed to Mongoose */
  options?: mongoose.ConnectOptions;
  /** Database name override */
  dbName?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Timeout for connection attempts (ms) */
  connectionTimeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Delay between retry attempts (ms) */
  retryDelay?: number;
  /** Enable SSL/TLS validation */
  validateSSL?: boolean;
  /** Allowed hosts whitelist for security */
  allowedHosts?: string[];
  /** Custom connection name for multi-db support */
  connectionName?: string;
}
```

### ConnectionState

```typescript
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTING = "disconnecting",
  ERROR = "error",
}
```

### ConnectionInfo

```typescript
interface ConnectionInfo {
  state: ConnectionState;
  connectedAt?: Date;
  lastError?: Error;
  host?: string;
  database?: string;
  connectionName: string;
  retryCount: number;
}
```

### SecurityValidation

```typescript
interface SecurityValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

### PoolStats

```typescript
interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  pendingConnections: number;
  failedConnections: number;
  connectionNames: string[];
}
```

### HealthCheck

```typescript
interface HealthCheck {
  isHealthy: boolean;
  connectionName: string;
  state: ConnectionState;
  latency?: number;
  lastPing?: Date;
  error?: string;
}
```

### MultiDbConnection

```typescript
interface MultiDbConnection {
  uri: string;
  name: string;
  options?: MongoConnectionOptions;
}
```

### MonitoringOptions

```typescript
interface MonitoringOptions {
  intervalMs?: number;
  onHealthChange?: (connectionName: string, isHealthy: boolean) => void;
  enableMetrics?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error";
}
```

### QuickConnectOptions

```typescript
interface QuickConnectOptions extends Partial<MongoConnectionOptions> {
  fallbackUri?: string;
  skipValidation?: boolean;
}
```

### Callback Types

```typescript
type OnConnectCallback = (
  connection: mongoose.Connection,
  info: ConnectionInfo
) => void | Promise<void>;
type OnDisconnectCallback = (info: ConnectionInfo) => void | Promise<void>;
type OnErrorCallback = (
  error: Error,
  info: ConnectionInfo
) => void | Promise<void>;
```

## 🔧 Configuration Examples

### Basic Configuration

```typescript
import { connectMongo } from "next-mongo-connector";

await connectMongo(process.env.MONGODB_URI, {
  connectionName: "main",
  debug: process.env.NODE_ENV === "development",
  maxRetries: 3,
  retryDelay: 1000,
  connectionTimeout: 10000,
});
```

### Security Configuration

```typescript
import { connectMongo } from "next-mongo-connector";

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

### Multi-Database Configuration

```typescript
import { connectMultiDb } from "next-mongo-connector";

const connections = [
  {
    uri: process.env.MAIN_DB_URI,
    name: "main",
    options: {
      connectionName: "main",
      maxPoolSize: 5,
    },
  },
  {
    uri: process.env.ANALYTICS_DB_URI,
    name: "analytics",
    options: {
      connectionName: "analytics",
      maxPoolSize: 3,
    },
  },
];

const connectionMap = await connectMultiDb(connections);
```

## 🚨 Error Handling

### Common Errors

#### Connection Errors

```typescript
try {
  await connectMongo(uri);
} catch (error) {
  if (error.message.includes("ECONNREFUSED")) {
    console.error("Database server is not running");
  } else if (error.message.includes("ENOTFOUND")) {
    console.error("Database host not found");
  } else {
    console.error("Connection failed:", error.message);
  }
}
```

#### Validation Errors

```typescript
import { validateURI } from "next-mongo-connector";

const validation = validateURI(uri);
if (!validation.isValid) {
  console.error("URI validation failed:", validation.errors);
  return;
}
```

#### Timeout Errors

```typescript
try {
  await connectMongo(uri, { connectionTimeout: 5000 });
} catch (error) {
  if (error.message.includes("timeout")) {
    console.error("Connection timed out");
  }
}
```

## 📊 Performance Considerations

### Connection Pooling

- Default pool size: 10 connections
- Configure based on your application needs
- Monitor pool statistics with `getPoolStats()`

### Caching

- Connections are automatically cached
- Reuse connections across requests
- Monitor cache with `getAllConnectionsInfo()`

### Timeouts

- Set appropriate timeouts for your environment
- Use `waitForConnection()` for critical operations
- Monitor connection health with `healthCheck()`

---

**For more examples and advanced usage, see the [README.md](README.md) file.**

### Webpack Configuration Functions

#### `createNextConfig(config?)`

Creates a Next.js configuration with MongoDB-friendly webpack settings.

**Parameters:**

- `config` (object, optional): Base Next.js configuration
  - `webpack` (function, optional): Custom webpack configuration function
  - Other Next.js configuration options

**Returns:** Next.js configuration object

**Example:**

```typescript
import { createNextConfig } from "next-mongo-connector";

// Simple usage
export default createNextConfig();

// With custom options
export default createNextConfig({
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Add custom webpack configuration
    return config;
  },
});
```

#### `createMongoWebpackConfig()```

⚠️ **Note**: You typically won't need to use this directly. Use `createNextConfig` instead.

Creates a webpack configuration for handling MongoDB optional dependencies.

**Returns:** Webpack configuration object with:

- Proper handling of native modules (.node files)
- Empty module substitution for optional dependencies
- Warning suppression for unresolved optionals

**Example:**

```typescript
import { createMongoWebpackConfig } from "next-mongo-connector";

const webpackConfig = createMongoWebpackConfig({
  // Custom webpack config options
});
```

### Optional Dependencies

The following optional dependencies are automatically handled:

| Package                     | Purpose                | Handling             |
| --------------------------- | ---------------------- | -------------------- |
| `kerberos`                  | GSSAPI authentication  | Empty implementation |
| `aws4`                      | AWS IAM auth           | Empty implementation |
| `mongodb-client-encryption` | Field level encryption | Empty implementation |
| `saslprep`                  | SCRAM auth             | Empty implementation |
| `snappy`                    | Compression            | Empty implementation |
| `bson-ext`                  | BSON performance       | Empty implementation |
| `@mongodb-js/zstd`          | Compression            | Empty implementation |

These dependencies are not required unless you specifically need their features. The package provides graceful fallbacks for all of them.
