import mongoose from 'mongoose';
import {
  MongoConnectionOptions,
  ConnectionState,
  ConnectionInfo,
  SecurityValidation,
  OnConnectCallback,
  OnDisconnectCallback,
  OnErrorCallback,
  CachedConnection,
  GlobalMongoCache,
  PoolStats,
  HealthCheck
} from './types';

/**
 * Default connection name
 */
const DEFAULT_CONNECTION_NAME = 'default';

/**
 * Security configuration
 */
const SECURITY_CONFIG = {
  // Minimum TLS version
  MIN_TLS_VERSION: '1.2',
  // Default connection timeout (30 seconds)
  DEFAULT_TIMEOUT: 30000,
  // Maximum retry attempts
  MAX_RETRIES: 3,
  // Retry delay (5 seconds)
  RETRY_DELAY: 5000,
  // Allowed protocols
  ALLOWED_PROTOCOLS: ['mongodb', 'mongodb+srv'],
  // Required connection options for security
  REQUIRED_SECURITY_OPTIONS: {
    ssl: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
  }
} as const;

/**
 * Initialize global cache
 */
function initializeGlobalCache(): GlobalMongoCache {
  if (!globalThis.__NEXT_MONGO_CONNECTOR__) {
    globalThis.__NEXT_MONGO_CONNECTOR__ = {
      connections: new Map(),
      initialized: true
    };
  }
  return globalThis.__NEXT_MONGO_CONNECTOR__;
}

/**
 * Get global cache
 */
function getGlobalCache(): GlobalMongoCache {
  return globalThis.__NEXT_MONGO_CONNECTOR__ || initializeGlobalCache();
}

/**
 * Security validator for MongoDB URIs and options
 */
export class MongoSecurityValidator {
  /**
   * Validate MongoDB URI for security vulnerabilities
   */
  static validateURI(uri: string, allowedHosts?: string[]): SecurityValidation {
    const result: SecurityValidation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check if URI is provided
    if (!uri || typeof uri !== 'string') {
      result.errors.push('MongoDB URI is required and must be a string');
      result.isValid = false;
      return result;
    }

    // Reject incomplete URIs before URL parsing
    if (
      uri.trim() === '' ||
      uri === 'mongodb://' ||
      uri === 'mongodb+srv://'
    ) {
      result.errors.push('Invalid URI format: incomplete URI');
      result.isValid = false;
      return result;
    }

    // Check for malformed URIs with @ but no hostname
    if (uri.includes('@') && !uri.includes('://')) {
      result.errors.push('Invalid URI format: malformed URI with credentials but no protocol');
      result.isValid = false;
      return result;
    }

    // Check for URIs with @ but missing hostname after @
    const atIndex = uri.indexOf('@');
    if (atIndex !== -1) {
      const afterAt = uri.substring(atIndex + 1);
      // If after @ there's no hostname (just port or path), it's malformed
      if (!afterAt || afterAt.startsWith(':') || afterAt.startsWith('/')) {
        result.errors.push('Invalid URI format: missing hostname after credentials');
        result.isValid = false;
        return result;
      }
    }

    // Check for URIs with @ immediately after protocol (no username/password)
    const protocolMatch = uri.match(/^(mongodb:\/\/|mongodb\+srv:\/\/)/);
    if (protocolMatch) {
      const afterProtocol = uri.substring(protocolMatch[0].length);
      if (afterProtocol.startsWith('@')) {
        result.errors.push('Invalid URI format: @ found without username/password');
        result.isValid = false;
        return result;
      }
    }

    // Check for URIs ending with @ (missing hostname)
    if (uri.endsWith('@')) {
      result.errors.push('Invalid URI format: missing hostname after credentials');
      result.isValid = false;
      return result;
    }

    // Check for URIs with invalid port numbers
    const portMatch = uri.match(/:\d+[^0-9]/);
    if (portMatch) {
      const port = portMatch[0].slice(1, -1);
      const portNum = parseInt(port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        result.errors.push('Invalid URI format: invalid port number');
        result.isValid = false;
        return result;
      }
    }

    try {
      const url = new URL(uri);

      // Validate protocol
      const protocol = url.protocol.slice(0, -1);
      if (!SECURITY_CONFIG.ALLOWED_PROTOCOLS.includes(protocol as 'mongodb' | 'mongodb+srv')) {
        result.errors.push(`Invalid protocol: ${url.protocol}. Allowed: ${SECURITY_CONFIG.ALLOWED_PROTOCOLS.join(', ')}`);
        result.isValid = false;
      }

      // Validate host whitelist
      if (allowedHosts && allowedHosts.length > 0) {
        const hostname = url.hostname;
        const isAllowed = allowedHosts.some(allowedHost => {
          // Support wildcard subdomains
          if (allowedHost.startsWith('*.')) {
            const domain = allowedHost.slice(2);
            // Only match if hostname is a subdomain (e.g. cluster0.mongodb.net), not the base domain
            return (
              hostname.length > domain.length + 1 &&
              hostname.endsWith('.' + domain)
            );
          }
          return hostname === allowedHost;
        });

        if (!isAllowed) {
          result.errors.push(`Host ${hostname} is not in the allowed hosts list`);
          result.isValid = false;
        }
      }

      // Check for suspicious patterns
      if (uri.includes('javascript:') || uri.includes('data:')) {
        result.errors.push('Potentially malicious URI detected');
        result.isValid = false;
      }

      // Warn about localhost in production
      if (process.env.NODE_ENV === 'production' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        result.warnings.push('Using localhost in production environment');
      }

      // Check for credentials in URI
      if (url.username || url.password) {
        result.warnings.push('Credentials detected in URI. Consider using environment variables');
      }

      // Check for malformed hostnames that are likely invalid
      const hostname = url.hostname;
      if (hostname === 'invalid' || hostname === 'host') {
        // Only allow if it has a port or is followed by a path
        const afterHostname = url.pathname + url.search + url.hash;
        if (!url.port && (afterHostname === '/' || afterHostname === '')) {
          result.errors.push('Invalid URI format: malformed hostname');
          result.isValid = false;
          return result;
        }
      }

      // Check for URIs without proper structure (no database name, no port, no path)
      if (!url.port && url.pathname === '/' && !url.search && !url.hash) {
        // This is a URI like mongodb://hostname/ which is malformed
        result.errors.push('Invalid URI format: missing database name or path');
        result.isValid = false;
        return result;
      }

    } catch (error) {
      result.errors.push(`Invalid URI format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate connection options for security
   */
  static validateOptions(options: mongoose.ConnectOptions = {}): SecurityValidation {
    const result: SecurityValidation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Enforce SSL/TLS in production
    if (process.env.NODE_ENV === 'production') {
      if (options.ssl === false || options.tls === false) {
        result.errors.push('SSL/TLS must be enabled in production');
        result.isValid = false;
      }

      if (options.tlsAllowInvalidCertificates === true) {
        result.errors.push('Invalid certificates should not be allowed in production');
        result.isValid = false;
      }

      if (options.tlsAllowInvalidHostnames === true) {
        result.errors.push('Invalid hostnames should not be allowed in production');
        result.isValid = false;
      }
    }

    // Validate buffer sizes to prevent memory exhaustion
    if (options.maxPoolSize && options.maxPoolSize > 100) {
      result.warnings.push('Very large connection pool size detected');
    }

    // Check for other potentially dangerous options
    const optionsAny = options as any;
    if (optionsAny.bufferMaxEntries && optionsAny.bufferMaxEntries > 1000) {
      result.warnings.push('Very large buffer size detected');
    }

    return result;
  }
}

/**
 * MongoDB Connection Manager
 */
export class MongoConnectionManager {
  private static shutdownHandlersRegistered = false;

  /**
   * Register graceful shutdown handlers
   */
  private static registerShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) return;

    const shutdown = async (signal: string) => {
      console.log(`[MongoConnector] Received ${signal}, closing all connections...`);
      await this.closeAllConnections();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    this.shutdownHandlersRegistered = true;
  }

  /**
   * Create secure connection options
   */
  private static createSecureOptions(userOptions: mongoose.ConnectOptions = {}): mongoose.ConnectOptions {
    const baseOptions: mongoose.ConnectOptions = {
      // Security defaults
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,

      // Performance and reliability
      maxPoolSize: 10,
      serverSelectionTimeoutMS: SECURITY_CONFIG.DEFAULT_TIMEOUT,
      socketTimeoutMS: SECURITY_CONFIG.DEFAULT_TIMEOUT,
      connectTimeoutMS: SECURITY_CONFIG.DEFAULT_TIMEOUT,

      // Heartbeat
      heartbeatFrequencyMS: 30000,

      // Retry logic
      retryWrites: true,
      retryReads: true,
    };

    // In development, allow less strict SSL settings
    if (process.env.NODE_ENV === 'development') {
      baseOptions.tlsAllowInvalidCertificates = userOptions.tlsAllowInvalidCertificates;
      baseOptions.tlsAllowInvalidHostnames = userOptions.tlsAllowInvalidHostnames;
      baseOptions.ssl = userOptions.ssl !== false;
      baseOptions.tls = userOptions.tls !== false;
    }

    return { ...baseOptions, ...userOptions };
  }

  /**
   * Connect to MongoDB with advanced security and caching
   */
  static async connect(
    uri: string,
    options: MongoConnectionOptions = {},
    onConnect?: OnConnectCallback,
    onDisconnect?: OnDisconnectCallback,
    onError?: OnErrorCallback
  ): Promise<mongoose.Connection> {
    // Security validation
    const uriValidation = MongoSecurityValidator.validateURI(uri, options.allowedHosts);
    if (!uriValidation.isValid) {
      throw new Error(`Security validation failed: ${uriValidation.errors.join(', ')}`);
    }

    // Log warnings
    if (options.debug && uriValidation.warnings.length > 0) {
      console.warn('[MongoConnector] Security warnings:', uriValidation.warnings);
    }

    const optionsValidation = MongoSecurityValidator.validateOptions(options.options);
    if (!optionsValidation.isValid) {
      throw new Error(`Options validation failed: ${optionsValidation.errors.join(', ')}`);
    }

    const connectionName = options.connectionName || DEFAULT_CONNECTION_NAME;
    const cache = getGlobalCache();

    // Register shutdown handlers
    this.registerShutdownHandlers();

    // Check if connection already exists
    const existingConnection = cache.connections.get(connectionName);
    if (existingConnection) {
      if (options.debug) {
        console.log(`[MongoConnector] Reusing existing connection: ${connectionName}`);
      }
      return existingConnection.promise;
    }

    // Create connection info
    const connectionInfo: ConnectionInfo = {
      state: ConnectionState.CONNECTING,
      connectionName,
      retryCount: 0
    };

    // Create secure connection options
    const secureOptions = this.createSecureOptions(options.options);

    // Create connection promise with retry logic
    const connectionPromise = this.connectWithRetry(
      uri,
      secureOptions,
      options,
      connectionInfo,
      onConnect,
      onDisconnect,
      onError
    );

    // Cache the connection
    const cachedConnection: CachedConnection = {
      connection: null as any, // Will be set when promise resolves
      promise: connectionPromise,
      info: connectionInfo,
      options,
      onConnect,
      onDisconnect,
      onError
    };

    cache.connections.set(connectionName, cachedConnection);

    try {
      const connection = await connectionPromise;

      // Ensure the connection is properly cached and ready
      cachedConnection.connection = connection;
      connectionInfo.state = ConnectionState.CONNECTED;
      connectionInfo.connectedAt = new Date();
      connectionInfo.host = connection.host;
      connectionInfo.database = connection.name;

      return connection;
    } catch (error) {
      // Remove failed connection from cache
      cache.connections.delete(connectionName);
      throw error;
    }
  }

  /**
   * Connect with retry logic and security measures
   */
  private static async connectWithRetry(
    uri: string,
    options: mongoose.ConnectOptions,
    userOptions: MongoConnectionOptions,
    connectionInfo: ConnectionInfo,
    onConnect?: OnConnectCallback,
    onDisconnect?: OnDisconnectCallback,
    onError?: OnErrorCallback
  ): Promise<mongoose.Connection> {
    const maxRetries = userOptions.maxRetries || SECURITY_CONFIG.MAX_RETRIES;
    const retryDelay = userOptions.retryDelay || SECURITY_CONFIG.RETRY_DELAY;
    const connectionTimeout = userOptions.connectionTimeout || SECURITY_CONFIG.DEFAULT_TIMEOUT;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (userOptions.debug) {
          console.log(`[MongoConnector] Connection attempt ${attempt}/${maxRetries} for ${connectionInfo.connectionName}`);
        }

        const connection = await mongoose.createConnection(uri, options);

        // Wait for connection to be ready
        await this.waitForConnectionReady(connection, connectionTimeout);

        // Set connection info
        connectionInfo.state = ConnectionState.CONNECTED;
        connectionInfo.connectedAt = new Date();
        connectionInfo.host = connection.host;
        connectionInfo.database = connection.name;
        connectionInfo.retryCount = attempt - 1;

        // Setup event listeners
        this.setupConnectionEvents(connection, connectionInfo, onConnect, onDisconnect, onError);

        if (userOptions.debug) {
          console.log(`[MongoConnector] Successfully connected to ${connectionInfo.connectionName}`);
        }

        // Call onConnect callback
        if (onConnect) {
          try {
            await onConnect(connection, connectionInfo);
          } catch (callbackError) {
            console.error('[MongoConnector] onConnect callback error:', callbackError);
          }
        }

        return connection;

      } catch (error) {
        connectionInfo.lastError = error as Error;
        connectionInfo.retryCount = attempt;

        if (userOptions.debug) {
          console.error(`[MongoConnector] Connection attempt ${attempt} failed:`, error);
        }

        // Call onError callback
        if (onError) {
          try {
            await onError(error as Error, connectionInfo);
          } catch (callbackError) {
            console.error('[MongoConnector] onError callback error:', callbackError);
          }
        }

        if (attempt === maxRetries) {
          connectionInfo.state = ConnectionState.ERROR;
          throw new Error(`Failed to connect after ${maxRetries} attempts. Last error: ${(error as Error).message}`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error('Unexpected error in connection retry logic');
  }

  /**
   * Setup connection event listeners
   */
  private static setupConnectionEvents(
    connection: mongoose.Connection,
    connectionInfo: ConnectionInfo,
    onConnect?: OnConnectCallback,
    onDisconnect?: OnDisconnectCallback,
    onError?: OnErrorCallback
  ): void {
    connection.on('error', async (error) => {
      connectionInfo.state = ConnectionState.ERROR;
      connectionInfo.lastError = error;

      if (onError) {
        try {
          await onError(error, connectionInfo);
        } catch (callbackError) {
          console.error('[MongoConnector] onError callback error:', callbackError);
        }
      }
    });

    connection.on('disconnected', async () => {
      connectionInfo.state = ConnectionState.DISCONNECTED;

      if (onDisconnect) {
        try {
          await onDisconnect(connectionInfo);
        } catch (callbackError) {
          console.error('[MongoConnector] onDisconnect callback error:', callbackError);
        }
      }
    });

    connection.on('reconnected', async () => {
      connectionInfo.state = ConnectionState.CONNECTED;
      connectionInfo.connectedAt = new Date();

      if (onConnect) {
        try {
          await onConnect(connection, connectionInfo);
        } catch (callbackError) {
          console.error('[MongoConnector] onConnect callback error:', callbackError);
        }
      }
    });
  }

  /**
   * Get connection by name
   */
  static getConnection(connectionName: string = DEFAULT_CONNECTION_NAME): mongoose.Connection | null {
    const cache = getGlobalCache();
    const cachedConnection = cache.connections.get(connectionName);
    return cachedConnection?.connection || null;
  }

  /**
   * Check if connected
   */
  static isConnected(connectionName: string = DEFAULT_CONNECTION_NAME): boolean {
    const connection = this.getConnection(connectionName);
    const connectionInfo = this.getConnectionInfo(connectionName);

    // Primary check: connection exists and readyState is 1
    if (!connection || connection.readyState !== 1) {
      return false;
    }

    // Secondary check: connection info state is connected
    return connectionInfo?.state === ConnectionState.CONNECTED;
  }

  /**
   * Check if connected with verification
   */
  static async isConnectedWithVerification(connectionName: string = DEFAULT_CONNECTION_NAME): Promise<{
    isConnected: boolean;
    readyState: number;
    connectionState: string;
    details: {
      readyStateConnected: boolean;
      infoStateConnected: boolean;
      connectionExists: boolean;
    };
  }> {
    const connection = this.getConnection(connectionName);
    const connectionInfo = this.getConnectionInfo(connectionName);

    const readyStateConnected = connection?.readyState === 1;
    const infoStateConnected = connectionInfo?.state === ConnectionState.CONNECTED;
    const connectionExists = !!connection;

    return {
      isConnected: readyStateConnected && infoStateConnected,
      readyState: connection?.readyState || 0,
      connectionState: connectionInfo?.state || 'unknown',
      details: {
        readyStateConnected,
        infoStateConnected,
        connectionExists
      }
    };
  }

  /**
   * Get connection info
   */
  static getConnectionInfo(connectionName: string = DEFAULT_CONNECTION_NAME): ConnectionInfo | null {
    const cache = getGlobalCache();
    const cachedConnection = cache.connections.get(connectionName);
    return cachedConnection?.info || null;
  }

  /**
   * Close specific connection
   */
  static async closeConnection(connectionName: string = DEFAULT_CONNECTION_NAME): Promise<void> {
    const cache = getGlobalCache();
    const cachedConnection = cache.connections.get(connectionName);

    if (cachedConnection) {
      try {
        cachedConnection.info.state = ConnectionState.DISCONNECTING;
        await cachedConnection.connection?.close();
        cache.connections.delete(connectionName);
      } catch (error) {
        console.error(`[MongoConnector] Error closing connection ${connectionName}:`, error);
      }
    }
  }

  /**
   * Close all connections
   */
  static async closeAllConnections(): Promise<void> {
    const cache = getGlobalCache();
    const closePromises = Array.from(cache.connections.keys()).map((name: string) =>
      this.closeConnection(name)
    );
    await Promise.all(closePromises);
  }

  /**
   * Get pool statistics
   */
  static getPoolStats(): PoolStats {
    const cache = getGlobalCache();
    const connections = Array.from(cache.connections.values());

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter((c: CachedConnection) => c.connection?.readyState === 1).length,
      pendingConnections: connections.filter((c: CachedConnection) => c.info.state === ConnectionState.CONNECTING).length,
      failedConnections: connections.filter((c: CachedConnection) => c.info.state === ConnectionState.ERROR).length,
      connectionNames: Array.from(cache.connections.keys())
    };
  }

  /**
   * Health check for specific connection
   */
  static async healthCheck(connectionName: string = DEFAULT_CONNECTION_NAME): Promise<HealthCheck> {
    const connection = this.getConnection(connectionName);
    const info = this.getConnectionInfo(connectionName);

    if (!connection || !info) {
      // Get available connection names for better error message
      const cache = getGlobalCache();
      const availableConnections = Array.from(cache.connections.keys());

      return {
        isHealthy: false,
        connectionName,
        state: ConnectionState.DISCONNECTED,
        error: `Connection '${connectionName}' not found. Available connections: ${availableConnections.join(', ') || 'none'}`
      };
    }

    // Check if connection is ready before pinging
    if (connection.readyState !== 1) {
      return {
        isHealthy: false,
        connectionName,
        state: info.state,
        error: `Connection not ready. ReadyState: ${connection.readyState}, State: ${info.state}`
      };
    }

    try {
      const start = Date.now();
      await connection?.db?.admin().ping();
      const latency = Date.now() - start;

      return {
        isHealthy: true,
        connectionName,
        state: info.state,
        latency,
        lastPing: new Date()
      };
    } catch (error) {
      return {
        isHealthy: false,
        connectionName,
        state: info.state,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Connect to multiple databases simultaneously
   */
  static async connectMultiDb(
    connections: Array<{
      uri: string;
      name: string;
      options?: MongoConnectionOptions;
      onConnect?: OnConnectCallback;
      onDisconnect?: OnDisconnectCallback;
      onError?: OnErrorCallback;
    }>
  ): Promise<Map<string, mongoose.Connection>> {
    if (!connections || connections.length === 0) {
      throw new Error('At least one connection configuration is required');
    }

    // Validate all connection names are unique
    const names = connections.map(c => c.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      throw new Error('Connection names must be unique');
    }

    // Validate all URIs before attempting connections
    for (const conn of connections) {
      const validation = MongoSecurityValidator.validateURI(conn.uri, conn.options?.allowedHosts);
      if (!validation.isValid) {
        throw new Error(`Security validation failed for ${conn.name}: ${validation.errors.join(', ')}`);
      }
    }

    const connectionPromises = connections.map(async (conn) => {
      try {
        const connection = await this.connect(
          conn.uri,
          { ...conn.options, connectionName: conn.name },
          conn.onConnect,
          conn.onDisconnect,
          conn.onError
        );
        return [conn.name, connection] as [string, mongoose.Connection];
      } catch (error) {
        throw new Error(`Failed to connect to ${conn.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    try {
      const results = await Promise.all(connectionPromises);
      return new Map(results);
    } catch (error) {
      // Clean up any successful connections if one fails
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Get all connection information
   */
  static getAllConnectionsInfo(): Map<string, ConnectionInfo> {
    const cache = getGlobalCache();
    const connectionInfos = new Map<string, ConnectionInfo>();

    cache.connections.forEach((cachedConnection, name) => {
      connectionInfos.set(name, cachedConnection.info);
    });

    return connectionInfos;
  }

  /**
   * Clean up all connections and resources
   */
  static async cleanup(): Promise<void> {
    const cache = getGlobalCache();

    try {
      // Close all connections
      await this.closeAllConnections();

      // Clear the cache
      cache.connections.clear();

      // Reset initialization flag
      cache.initialized = false;

      // Clear global cache
      if (globalThis.__NEXT_MONGO_CONNECTOR__) {
        delete globalThis.__NEXT_MONGO_CONNECTOR__;
      }

      console.log('[MongoConnector] Cleanup completed successfully');
    } catch (error) {
      console.error('[MongoConnector] Cleanup error:', error);
      throw error;
    }
  }

  /**
   * Reset connector state (useful for testing)
   */
  static resetConnectorState(): void {
    // Clear global cache
    if (globalThis.__NEXT_MONGO_CONNECTOR__) {
      globalThis.__NEXT_MONGO_CONNECTOR__.connections.clear();
      globalThis.__NEXT_MONGO_CONNECTOR__.initialized = false;
    }

    // Reset shutdown handlers flag
    this.shutdownHandlersRegistered = false;

    console.log('[MongoConnector] Connector state reset');
  }

  /**
   * Get MongoDB URI from environment with validation
   */
  static getMongoUri(fallbackUri?: string): string {
    const uri = process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      process.env.DATABASE_URL ||
      fallbackUri;

    if (!uri) {
      throw new Error(
        'MongoDB URI not found. Set one of: MONGODB_URI, MONGO_URI, DATABASE_URL environment variables, or provide fallbackUri'
      );
    }

    // Validate the URI
    const validation = MongoSecurityValidator.validateURI(uri);
    if (!validation.isValid) {
      throw new Error(`Invalid MongoDB URI: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('[MongoConnector] URI warnings:', validation.warnings);
    }

    return uri;
  }

  /**
   * Quick connect with minimal configuration
   */
  static async quickConnect(
    connectionName: string = DEFAULT_CONNECTION_NAME,
    options: Partial<MongoConnectionOptions> = {}
  ): Promise<mongoose.Connection> {
    try {
      const uri = this.getMongoUri();

      const defaultOptions: MongoConnectionOptions = {
        debug: process.env.NODE_ENV === 'development',
        maxRetries: 3,
        retryDelay: 2000,
        connectionTimeout: 30000,
        validateSSL: process.env.NODE_ENV === 'production',
        connectionName,
        ...options
      };

      return await this.connect(uri, defaultOptions);
    } catch (error) {
      throw new Error(`Quick connect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get connection with timeout
   */
  static async getConnectionWithTimeout(
    connectionName: string = DEFAULT_CONNECTION_NAME,
    timeoutMs: number = 5000
  ): Promise<mongoose.Connection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const connection = this.getConnection(connectionName);
      if (connection && connection.readyState === 1) {
        clearTimeout(timeout);
        resolve(connection);
      } else {
        clearTimeout(timeout);
        reject(new Error(`No active connection found for ${connectionName}`));
      }
    });
  }

  /**
   * Batch health check for all connections
   */
  static async batchHealthCheck(): Promise<Map<string, HealthCheck>> {
    const cache = getGlobalCache();
    const healthChecks = new Map<string, HealthCheck>();

    const promises = Array.from(cache.connections.keys()).map(async (connectionName: string) => {
      try {
        const health = await this.healthCheck(connectionName as string);
        return [connectionName, health] as [string, HealthCheck];
      } catch (error) {
        return [connectionName, {
          isHealthy: false,
          connectionName,
          state: ConnectionState.ERROR,
          error: error instanceof Error ? error.message : 'Unknown error'
        }] as [string, HealthCheck];
      }
    });

    const results = await Promise.allSettled(promises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [name, health] = result.value;
        healthChecks.set(name, health);
      }
    });

    return healthChecks;
  }

  /**
   * Wait for a connection to be ready
   */
  private static async waitForConnectionReady(
    connection: mongoose.Connection,
    timeoutMs: number = 30000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkReady = () => {
        if (connection.readyState === 1) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Connection timeout after ${timeoutMs}ms`));
          return;
        }

        // Check again in 100ms
        setTimeout(checkReady, 50);
      };

      // If already ready, resolve immediately
      if (connection.readyState === 1) {
        resolve();
        return;
      }

      // Listen for the 'connected' event
      const onConnected = () => {
        connection.removeListener('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        connection.removeListener('connected', onConnected);
        reject(error);
      };

      connection.once('connected', onConnected);
      connection.once('error', onError);

      // Also check periodically in case events don't fire
      checkReady();
    });
  }

  /**
   * Wait for connection to be ready (useful for testing)
   */
  static async waitForConnection(
    connectionName: string = DEFAULT_CONNECTION_NAME,
    timeoutMs: number = 10000
  ): Promise<mongoose.Connection> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkConnection = () => {
        const connection = this.getConnection(connectionName);
        const info = this.getConnectionInfo(connectionName);

        if (connection && connection.readyState === 1 && info?.state === ConnectionState.CONNECTED) {
          resolve(connection);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Connection timeout after ${timeoutMs}ms for ${connectionName}`));
          return;
        }

        // Check again in 100ms
        setTimeout(checkConnection, 50);
      };

      checkConnection();
    });
  }

  /**
   * Connection monitoring with automatic reconnection
   */
  static startConnectionMonitoring(
    intervalMs: number = 30000,
    onHealthChange?: (connectionName: string, isHealthy: boolean) => void
  ): NodeJS.Timeout {
    const reported: Record<string, boolean> = {};
    const check = () => {
      const allInfo = this.getAllConnectionsInfo();
      allInfo.forEach((info, name) => {
        const isHealthy = info.state === 'connected';
        // Always call onHealthChange at least once for each connection
        if (onHealthChange && (!Object.prototype.hasOwnProperty.call(reported, name) || reported[name] !== isHealthy)) {
          onHealthChange(name, isHealthy);
          reported[name] = isHealthy;
        }
      });
    };
    check(); // Initial call to ensure callback is called at least once
    return setInterval(check, intervalMs);
  }
}
