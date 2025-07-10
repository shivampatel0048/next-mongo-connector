import mongoose from 'mongoose';

/**
 * Connection options for MongoDB
 */
export interface MongoConnectionOptions {
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

/**
 * Connection state enum
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error'
}

/**
 * Connection metadata
 */
export interface ConnectionInfo {
  state: ConnectionState;
  connectedAt?: Date;
  lastError?: Error;
  host?: string;
  database?: string;
  connectionName: string;
  retryCount: number;
}

/**
 * Security validation result
 */
export interface SecurityValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Event callback types
 */
export type OnConnectCallback = (connection: mongoose.Connection, info: ConnectionInfo) => void | Promise<void>;
export type OnDisconnectCallback = (info: ConnectionInfo) => void | Promise<void>;
export type OnErrorCallback = (error: Error, info: ConnectionInfo) => void | Promise<void>;

/**
 * Global connection cache interface
 */
export interface CachedConnection {
  connection: mongoose.Connection;
  promise: Promise<mongoose.Connection>;
  info: ConnectionInfo;
  options: MongoConnectionOptions;
  onConnect?: OnConnectCallback;
  onDisconnect?: OnDisconnectCallback;
  onError?: OnErrorCallback;
}

/**
 * Global cache type
 */
export interface GlobalMongoCache {
  connections: Map<string, CachedConnection>;
  initialized: boolean;
}

export { };

/**
 * Connection pool statistics
 */
export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  pendingConnections: number;
  failedConnections: number;
  connectionNames: string[];
}

/**
 * Health check result
 */
export interface HealthCheck {
  isHealthy: boolean;
  connectionName: string;
  state: ConnectionState;
  latency?: number;
  lastPing?: Date;
  error?: string;
}

/**
 * Multi-database connection configuration
 */
export interface MultiDbConnection {
  uri: string;
  name: string;
  options?: MongoConnectionOptions;
}

/**
 * Monitoring options
 */
export interface MonitoringOptions {
  intervalMs?: number;
  onHealthChange?: (connectionName: string, isHealthy: boolean) => void;
  enableMetrics?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Quick connect options
 */
export interface QuickConnectOptions extends Partial<MongoConnectionOptions> {
  fallbackUri?: string;
  skipValidation?: boolean;
}
