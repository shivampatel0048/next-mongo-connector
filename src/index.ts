import mongoose from 'mongoose';
import { MongoConnectionManager, MongoSecurityValidator } from './connector';
import { createMongoWebpackConfig, createNextConfig } from './webpack-config';
import {
  MongoConnectionOptions,
  ConnectionState,
  ConnectionInfo,
  SecurityValidation,
  OnConnectCallback,
  OnDisconnectCallback,
  OnErrorCallback,
  PoolStats,
  HealthCheck,
  MultiDbConnection,
  MonitoringOptions,
  QuickConnectOptions
} from './types';

/**
 * Connect to MongoDB with enhanced security and caching
 * @param uri MongoDB connection URI
 * @param options Connection options
 * @param onConnect Callback for successful connection
 * @param onDisconnect Callback for disconnection
 * @param onError Callback for connection errors
 * @returns Promise that resolves to MongoDB connection
 */
export async function connectMongo(
  uri?: string,
  options: MongoConnectionOptions = {},
  onConnect?: OnConnectCallback,
  onDisconnect?: OnDisconnectCallback,
  onError?: OnErrorCallback
): Promise<mongoose.Connection> {
  // Try to get URI from environment if not provided
  const connectionUri = uri || process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!connectionUri) {
    throw new Error('MongoDB URI is required. Provide it as parameter or set MONGODB_URI environment variable.');
  }

  return MongoConnectionManager.connect(
    connectionUri,
    options,
    onConnect,
    onDisconnect,
    onError
  );
}

/**
 * Get database instance from connection
 * @param connectionName Name of the connection (optional)
 * @returns Database instance
 */
export function getDb(connectionName?: string): mongoose.Connection['db'] {
  const connection = MongoConnectionManager.getConnection(connectionName);
  if (!connection) {
    throw new Error(`No active connection found${connectionName ? ` for ${connectionName}` : ''}`);
  }
  return connection.db;
}

/**
 * Get MongoDB connection instance
 * @param connectionName Name of the connection (optional)
 * @returns Connection instance
 */
export function getConnection(connectionName?: string): mongoose.Connection {
  const connection = MongoConnectionManager.getConnection(connectionName);
  if (!connection) {
    throw new Error(`No active connection found${connectionName ? ` for ${connectionName}` : ''}`);
  }
  return connection;
}

/**
 * Check if MongoDB is connected
 * @param connectionName Name of the connection (optional)
 * @returns True if connected
 */
export function isConnected(connectionName?: string): boolean {
  return MongoConnectionManager.isConnected(connectionName);
}

/**
 * Check if connected with detailed verification
 * @param connectionName Name of the connection (optional)
 * @returns Detailed connection status
 */
export async function isConnectedWithVerification(connectionName?: string) {
  return MongoConnectionManager.isConnectedWithVerification(connectionName);
}

/**
 * Get connection information
 * @param connectionName Name of the connection (optional)
 * @returns Connection info
 */
export function getConnectionInfo(connectionName?: string): ConnectionInfo | null {
  return MongoConnectionManager.getConnectionInfo(connectionName);
}

/**
 * Close MongoDB connection
 * @param connectionName Name of the connection (optional)
 */
export async function closeConnection(connectionName?: string): Promise<void> {
  return MongoConnectionManager.closeConnection(connectionName);
}

/**
 * Close all MongoDB connections
 */
export async function closeAllConnections(): Promise<void> {
  return MongoConnectionManager.closeAllConnections();
}

/**
 * Get connection pool statistics
 * @returns Pool statistics
 */
export function getPoolStats(): PoolStats {
  return MongoConnectionManager.getPoolStats();
}

/**
 * Perform health check on connection
 * @param connectionName Name of the connection (optional)
 * @returns Health check result
 */
export async function healthCheck(connectionName?: string): Promise<HealthCheck> {
  return MongoConnectionManager.healthCheck(connectionName);
}

/**
 * Validate MongoDB URI for security
 * @param uri MongoDB URI to validate
 * @param allowedHosts Optional list of allowed hosts
 * @returns Validation result
 */
export function validateURI(uri: string, allowedHosts?: string[]): SecurityValidation {
  return MongoSecurityValidator.validateURI(uri, allowedHosts);
}

/**
 * Validate connection options for security
 * @param options Connection options to validate
 * @returns Validation result
 */
export function validateOptions(options: mongoose.ConnectOptions): SecurityValidation {
  return MongoSecurityValidator.validateOptions(options);
}

/**
 * Connect to multiple databases simultaneously
 * @param connections Array of connection configurations
 * @returns Map of connection names to connection instances
 */
export async function connectMultiDb(
  connections: MultiDbConnection[]
): Promise<Map<string, mongoose.Connection>> {
  return MongoConnectionManager.connectMultiDb(connections);
}

/**
 * Get all connection information
 * @returns Map of connection names to connection info
 */
export function getAllConnectionsInfo(): Map<string, ConnectionInfo> {
  return MongoConnectionManager.getAllConnectionsInfo();
}

/**
 * Clean up all connections and resources
 */
export async function cleanup(): Promise<void> {
  return MongoConnectionManager.cleanup();
}

/**
 * Reset connector state (useful for testing)
 */
export function resetConnectorState(): void {
  return MongoConnectionManager.resetConnectorState();
}

/**
 * Get MongoDB URI from environment with validation
 * @param fallbackUri Optional fallback URI
 * @returns Validated MongoDB URI
 */
export function getMongoUri(fallbackUri?: string): string {
  return MongoConnectionManager.getMongoUri(fallbackUri);
}

/**
 * Quick connect with minimal configuration
 * @param connectionName Name of the connection
 * @param options Quick connect options
 * @returns Promise that resolves to MongoDB connection
 */
export async function quickConnect(
  connectionName?: string,
  options?: QuickConnectOptions
): Promise<mongoose.Connection> {
  return MongoConnectionManager.quickConnect(connectionName, options);
}

/**
 * Get connection with timeout
 * @param connectionName Name of the connection
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise that resolves to MongoDB connection
 */
export async function getConnectionWithTimeout(
  connectionName?: string,
  timeoutMs?: number
): Promise<mongoose.Connection> {
  return MongoConnectionManager.getConnectionWithTimeout(connectionName, timeoutMs);
}

/**
 * Batch health check for all connections
 * @returns Map of connection names to health check results
 */
export async function batchHealthCheck(): Promise<Map<string, HealthCheck>> {
  return MongoConnectionManager.batchHealthCheck();
}

/**
 * Wait for connection to be ready (useful for testing)
 * @param connectionName Name of the connection
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise that resolves to MongoDB connection
 */
export async function waitForConnection(
  connectionName?: string,
  timeoutMs?: number
): Promise<mongoose.Connection> {
  return MongoConnectionManager.waitForConnection(connectionName, timeoutMs);
}

/**
 * Start connection monitoring with automatic reconnection
 * @param intervalMs Monitoring interval in milliseconds
 * @param onHealthChange Callback for health changes
 * @returns Timer ID for stopping monitoring
 */
export function startConnectionMonitoring(
  intervalMs?: number,
  onHealthChange?: (connectionName: string, isHealthy: boolean) => void
): NodeJS.Timeout {
  return MongoConnectionManager.startConnectionMonitoring(intervalMs, onHealthChange);
}

// Re-export types for TypeScript users
export type {
  MongoConnectionOptions,
  ConnectionInfo,
  SecurityValidation,
  OnConnectCallback,
  OnDisconnectCallback,
  OnErrorCallback,
  PoolStats,
  HealthCheck,
  MultiDbConnection,
  MonitoringOptions,
  QuickConnectOptions
};

// Re-export enum
export { ConnectionState };

// Webpack utilities for handling optional dependencies
export { createMongoWebpackConfig, createNextConfig };

// Default export for convenience
export default {
  connectMongo,
  getDb,
  getConnection,
  isConnected,
  isConnectedWithVerification,
  getConnectionInfo,
  closeConnection,
  closeAllConnections,
  getPoolStats,
  healthCheck,
  validateURI,
  validateOptions,
  connectMultiDb,
  getAllConnectionsInfo,
  cleanup,
  resetConnectorState,
  getMongoUri,
  quickConnect,
  getConnectionWithTimeout,
  batchHealthCheck,
  waitForConnection,
  startConnectionMonitoring,
  ConnectionState
};