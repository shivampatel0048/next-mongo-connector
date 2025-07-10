import {
  connectMongo,
  getDb,
  isConnected,
  closeConnection,
  closeAllConnections,
  getConnectionInfo,
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
} from '../index';

describe('Next MongoDB Connector - Real Atlas Tests', () => {
  // Use real MongoDB Atlas URI with different databases for testing
  const ATLAS_BASE_URI = 'mongodb+srv://shivampatel0048:BvDiuHw67hBpYSKi@cluster0.uplbr9s.mongodb.net';
  const ATLAS_PARAMS = '?retryWrites=true&w=majority&appName=Cluster0';

  const getAtlasUri = (dbName: string) => `${ATLAS_BASE_URI}/${dbName}${ATLAS_PARAMS}`;

  beforeEach(async () => {
    // Clear global cache before each test
    if (globalThis.__NEXT_MONGO_CONNECTOR__) {
      globalThis.__NEXT_MONGO_CONNECTOR__.connections.clear();
    }
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up all connections after each test
    await closeAllConnections();
    resetConnectorState();
  });

  afterAll(async () => {
    // Final cleanup
    await closeAllConnections();
    resetConnectorState();
  });

  describe('connectMongo', () => {
    it('should connect to MongoDB successfully', async () => {
      const connection = await connectMongo(getAtlasUri('test-connector'));
      expect(connection).toBeDefined();
      expect(connection.readyState).toBe(1);
    }, 30000);

    it('should use environment variable if URI not provided', async () => {
      process.env.MONGODB_URI = getAtlasUri('env-test');
      const connection = await connectMongo();
      expect(connection).toBeDefined();
      delete process.env.MONGODB_URI;
    }, 30000);

    it('should throw error if no URI provided', async () => {
      delete process.env.MONGODB_URI;
      delete process.env.MONGO_URI;
      await expect(connectMongo()).rejects.toThrow('MongoDB URI is required');
    });

    it('should cache connections properly', async () => {
      const connection1 = await connectMongo(getAtlasUri('cache-test'));
      const connection2 = await connectMongo(getAtlasUri('cache-test'));
      expect(connection1).toBe(connection2);
    }, 30000);

    it('should handle onConnect callback', async () => {
      const onConnect = jest.fn();
      await connectMongo(getAtlasUri('callback-test'), {}, onConnect);
      expect(onConnect).toHaveBeenCalled();
    }, 30000);

    it('should validate URI security', async () => {
      await expect(
        connectMongo('javascript:alert(1)', {})
      ).rejects.toThrow('Security validation failed');
    });

    it('should respect allowed hosts', async () => {
      await expect(
        connectMongo('mongodb://malicious.com:27017/test', {
          allowedHosts: ['localhost', 'trusted.com']
        })
      ).rejects.toThrow('Host malicious.com is not in the allowed hosts list');
    });
  });

  describe('getDb', () => {
    it('should return database instance', async () => {
      await connectMongo(getAtlasUri('getdb-test'));
      const db = getDb();
      expect(db).toBeDefined();
    }, 30000);

    it('should throw error if no connection', () => {
      expect(() => getDb()).toThrow('No active connection found');
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      await connectMongo(getAtlasUri('isconnected-test'));
      expect(isConnected()).toBe(true);
    }, 30000);

    it('should return false when not connected', () => {
      expect(isConnected()).toBe(false);
    });
  });

  describe('getConnectionInfo', () => {
    it('should return connection info', async () => {
      await connectMongo(getAtlasUri('connectioninfo-test'));
      const info = getConnectionInfo();
      expect(info).toBeDefined();
      expect(info?.state).toBe(ConnectionState.CONNECTED);
      expect(info?.connectionName).toBe('default');
    }, 30000);

    it('should return null if no connection', () => {
      expect(getConnectionInfo()).toBeNull();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', async () => {
      await connectMongo(getAtlasUri('poolstats-test'));
      const stats = getPoolStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
      expect(stats.connectionNames).toContain('default');
    }, 30000);
  });

  describe('healthCheck', () => {
    it('should perform health check successfully', async () => {
      await connectMongo(getAtlasUri('healthcheck-test'));
      const health = await healthCheck();
      expect(health.isHealthy).toBe(true);
      expect(health.connectionName).toBe('default');
      expect(typeof health.latency).toBe('number');
    }, 30000);

    it('should return unhealthy for non-existent connection', async () => {
      const health = await healthCheck();
      expect(health.isHealthy).toBe(false);
      expect(health.error).toBe('Connection \'default\' not found. Available connections: none');
    });
  });

  describe('validateURI', () => {
    it('should validate correct URI', () => {
      const result = validateURI(getAtlasUri('validation-test'));
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid protocol', () => {
      const result = validateURI('http://localhost:27017/test');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid protocol: http:. Allowed: mongodb, mongodb+srv');
    });

    it('should reject malicious URI', () => {
      const result = validateURI('javascript:alert(1)');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Potentially malicious URI detected');
    });

    it('should validate host whitelist', () => {
      const result = validateURI('mongodb://malicious.com:27017/test', ['localhost']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Host malicious.com is not in the allowed hosts list');
    });

    it('should support wildcard hosts', () => {
      const result = validateURI('mongodb://sub.example.com:27017/test', ['*.example.com']);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateOptions', () => {
    it('should validate secure options', () => {
      const result = validateOptions({
        ssl: true,
        tls: true,
        tlsAllowInvalidCertificates: false
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject insecure options in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = validateOptions({
        ssl: false,
        tls: false
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SSL/TLS must be enabled in production');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('multiple connections', () => {
    it('should handle multiple named connections', async () => {
      await connectMongo(getAtlasUri('multi-db1'), {
        connectionName: 'db1'
      });
      await connectMongo(getAtlasUri('multi-db2'), {
        connectionName: 'db2'
      });

      expect(getPoolStats().totalConnections).toBe(2);
      expect(isConnected('db1')).toBe(true);
      expect(isConnected('db2')).toBe(true);
    }, 30000);
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const onError = jest.fn();

      await expect(
        connectMongo('mongodb+srv://invalid:invalid@invalid.mongodb.net/test', {
          maxRetries: 1,
          retryDelay: 100,
          connectionTimeout: 2000
        }, undefined, undefined, onError)
      ).rejects.toThrow();

      expect(onError).toHaveBeenCalled();
    }, 15000);
  });

  describe('security features', () => {
    it('should enforce security defaults', async () => {
      await connectMongo(getAtlasUri('security-test'), {
        options: {
          ssl: true,
          tls: true
        }
      });



      // Verify connection was established with secure defaults
      expect(isConnected()).toBe(true);
    }, 30000);

    it('should prevent buffer overflow attacks', () => {
      const result = validateOptions({
        maxPoolSize: 10000,
        // Cast to any to test the buffer validation since bufferMaxEntries is not in official types
        ...(({ bufferMaxEntries: 50000 } as any))
      });

      expect(result.warnings).toContain('Very large connection pool size detected');
      expect(result.warnings).toContain('Very large buffer size detected');
    });
  });

  describe('performance optimization', () => {
    it('should reuse existing connections', async () => {
      // First connection
      await connectMongo(getAtlasUri('performance-test'));

      const stats1 = getPoolStats();

      // Second connection should reuse the first
      await connectMongo(getAtlasUri('performance-test'));

      const stats2 = getPoolStats();

      expect(stats1.totalConnections).toBe(1);
      expect(stats2.totalConnections).toBe(1); // Still 1, not 2
    }, 30000);
  });

  describe('connectMultiDb', () => {
    it('should connect to multiple databases', async () => {
      const connections = [
        {
          uri: getAtlasUri('multidb1'),
          name: 'database1'
        },
        {
          uri: getAtlasUri('multidb2'),
          name: 'database2'
        }
      ];

      const { connectMultiDb } = await import('../index');
      const connectionMap = await connectMultiDb(connections);

      // Wait for connections to be ready
      expect(connectionMap.size).toBe(2);
      expect(connectionMap.has('database1')).toBe(true);
      expect(connectionMap.has('database2')).toBe(true);
    }, 30000);

    it('should reject duplicate connection names', async () => {
      const connections = [
        {
          uri: getAtlasUri('duplicate1'),
          name: 'duplicate'
        },
        {
          uri: getAtlasUri('duplicate2'),
          name: 'duplicate'
        }
      ];

      const { connectMultiDb } = await import('../index');
      await expect(connectMultiDb(connections)).rejects.toThrow('Connection names must be unique');
    });

    it('should validate all URIs before connecting', async () => {
      const connections = [
        {
          uri: getAtlasUri('valid-db'),
          name: 'valid'
        },
        {
          uri: 'javascript:alert(1)',
          name: 'malicious'
        }
      ];

      const { connectMultiDb } = await import('../index');
      await expect(connectMultiDb(connections)).rejects.toThrow('Security validation failed');
    });
  });

  describe('getAllConnectionsInfo', () => {
    it('should return all connection information', async () => {
      await connectMongo(getAtlasUri('test1'), { connectionName: 'test1' });
      await connectMongo(getAtlasUri('test2'), { connectionName: 'test2' });

      const { getAllConnectionsInfo } = await import('../index');
      const allInfo = getAllConnectionsInfo();

      expect(allInfo.size).toBe(2);
      expect(allInfo.has('test1')).toBe(true);
      expect(allInfo.has('test2')).toBe(true);
    }, 30000);

    it('should return empty map when no connections', async () => {
      const { getAllConnectionsInfo } = await import('../index');
      const allInfo = getAllConnectionsInfo();
      expect(allInfo.size).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up all connections and reset state', async () => {
      await connectMongo(getAtlasUri('cleanup-test'));

      expect(isConnected()).toBe(true);

      const { cleanup } = await import('../index');
      await cleanup();

      expect(isConnected()).toBe(false);
      expect(getPoolStats().totalConnections).toBe(0);
    }, 30000);
  });

  describe('resetConnectorState', () => {
    it('should reset the connector state', async () => {
      await connectMongo(getAtlasUri('reset-test'));


      const { resetConnectorState } = await import('../index');
      resetConnectorState();

      // State should be reset but connections might still exist
      // This is mainly for testing purposes
      expect(() => resetConnectorState()).not.toThrow();
    }, 30000);
  });

  describe('getMongoUri', () => {
    it('should get URI from environment', async () => {
      process.env.MONGODB_URI = getAtlasUri('env-uri-test');

      const { getMongoUri } = await import('../index');
      const uri = getMongoUri();

      expect(uri).toBe(getAtlasUri('env-uri-test'));
      delete process.env.MONGODB_URI;
    });

    it('should use fallback URI when env not set', async () => {
      delete process.env.MONGODB_URI;
      delete process.env.MONGO_URI;
      delete process.env.DATABASE_URL;

      const { getMongoUri } = await import('../index');
      const fallbackUri = getAtlasUri('fallback-test');
      const uri = getMongoUri(fallbackUri);

      expect(uri).toBe(fallbackUri);
    });

    it('should throw error when no URI available', async () => {
      delete process.env.MONGODB_URI;
      delete process.env.MONGO_URI;
      delete process.env.DATABASE_URL;

      const { getMongoUri } = await import('../index');
      expect(() => getMongoUri()).toThrow('MongoDB URI not found');
    });

    it('should validate the URI', async () => {
      const { getMongoUri } = await import('../index');
      expect(() => getMongoUri('javascript:alert(1)')).toThrow('Invalid MongoDB URI');
    });
  });

  describe('quickConnect', () => {
    it('should connect with minimal configuration', async () => {
      process.env.MONGODB_URI = getAtlasUri('quick-test');

      const { quickConnect } = await import('../index');
      await quickConnect();
      expect(isConnected()).toBe(true);

      delete process.env.MONGODB_URI;
    }, 30000);

    it('should use custom connection name', async () => {
      process.env.MONGODB_URI = getAtlasUri('quick-named-test');

      const { quickConnect, isConnected } = await import('../index');
      await quickConnect('quick-connection');
      expect(isConnected('quick-connection')).toBe(true);

      delete process.env.MONGODB_URI;
    }, 30000);
  });

  describe('getConnectionWithTimeout', () => {
    it('should get connection within timeout', async () => {
      await connectMongo(getAtlasUri('timeout-test'));


      const { getConnectionWithTimeout } = await import('../index');
      const connection = await getConnectionWithTimeout('default', 1000);

      expect(connection).toBeDefined();
    }, 30000);

    it('should timeout when connection not available', async () => {
      const { getConnectionWithTimeout } = await import('../index');

      await expect(
        getConnectionWithTimeout('nonexistent', 100)
      ).rejects.toThrow('No active connection found');
    });
  });

  describe('batchHealthCheck', () => {
    it('should perform health check on all connections', async () => {
      await connectMongo(getAtlasUri('batch-test1'), { connectionName: 'test1' });
      await connectMongo(getAtlasUri('batch-test2'), { connectionName: 'test2' });

      const { batchHealthCheck } = await import('../index');
      const healthChecks = await batchHealthCheck();

      expect(healthChecks.size).toBe(2);
      expect(healthChecks.has('test1')).toBe(true);
      expect(healthChecks.has('test2')).toBe(true);
    }, 30000);

    it('should handle empty connections', async () => {
      const { batchHealthCheck } = await import('../index');
      const healthChecks = await batchHealthCheck();

      expect(healthChecks.size).toBe(0);
    });
  });

  describe('startConnectionMonitoring', () => {
    it('should start monitoring and return timer', async () => {
      await connectMongo(getAtlasUri('monitoring-test'));


      const { startConnectionMonitoring } = await import('../index');
      const timer = startConnectionMonitoring(100);

      expect(timer).toBeDefined();
      expect(typeof timer).toBe('object');

      // Clean up timer
      clearInterval(timer);
    }, 30000);

    it('should call health change callback', async () => {
      await connectMongo(getAtlasUri('callback-monitoring-test'));


      const onHealthChange = jest.fn();
      const { startConnectionMonitoring } = await import('../index');
      const timer = startConnectionMonitoring(50, onHealthChange);

      // Wait for at least one monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onHealthChange).toHaveBeenCalled();

      // Clean up timer
      clearInterval(timer);
    }, 30000);
  });

  describe('Real CRUD Operations', () => {
    it('should perform real CRUD operations on MongoDB Atlas', async () => {
      try {
        // Connect to real MongoDB Atlas
        await connectMongo(getAtlasUri('crud-operations-test'));


        const db = getDb();
        if (!db) {
          throw new Error('Database connection not available');
        }

        // Use a test collection
        const collection = db.collection('test_crud_operations');

        // Test document
        const testDoc = {
          name: 'Real CRUD Test',
          email: 'realtest@example.com',
          status: 'active',
          createdAt: new Date(),
          testRun: `test-${Date.now()}`
        };

        // CREATE operation
        const insertResult = await collection.insertOne(testDoc);
        expect(insertResult.insertedId).toBeDefined();
        expect(insertResult.acknowledged).toBe(true);

        // READ operation - findOne
        const foundDoc = await collection.findOne({ _id: insertResult.insertedId });
        expect(foundDoc).toBeDefined();
        expect(foundDoc?.name).toBe('Real CRUD Test');
        expect(foundDoc?.email).toBe('realtest@example.com');
        expect(foundDoc?.status).toBe('active');

        // READ operation - find with query
        const docs = await collection.find({ status: 'active' }).limit(5).toArray();
        expect(docs.length).toBeGreaterThan(0);
        const ourDoc = docs.find(doc => doc._id.toString() === insertResult.insertedId.toString());
        expect(ourDoc).toBeDefined();

        // UPDATE operation
        const updateResult = await collection.updateOne(
          { _id: insertResult.insertedId },
          {
            $set: {
              status: 'updated',
              updatedAt: new Date(),
              updateCount: 1
            }
          }
        );
        expect(updateResult.matchedCount).toBe(1);
        expect(updateResult.modifiedCount).toBe(1);
        expect(updateResult.acknowledged).toBe(true);

        // Verify update
        const updatedDoc = await collection.findOne({ _id: insertResult.insertedId });
        expect(updatedDoc?.status).toBe('updated');
        expect(updatedDoc?.updateCount).toBe(1);
        expect(updatedDoc?.updatedAt).toBeInstanceOf(Date);

        // COUNT operation
        const count = await collection.countDocuments({ status: 'updated' });
        expect(count).toBeGreaterThan(0);

        // DELETE operation
        const deleteResult = await collection.deleteOne({ _id: insertResult.insertedId });
        expect(deleteResult.deletedCount).toBe(1);
        expect(deleteResult.acknowledged).toBe(true);

        // Verify deletion
        const deletedDoc = await collection.findOne({ _id: insertResult.insertedId });
        expect(deletedDoc).toBeNull();

        console.log('✅ Real MongoDB Atlas CRUD operations completed successfully');

      } catch (error) {
        console.error('❌ Real MongoDB Atlas CRUD test failed:', error);
        throw error;
      }
    }, 60000); // 60 second timeout for real network operations

    it('should handle batch operations on MongoDB Atlas', async () => {
      try {
        await connectMongo(getAtlasUri('batch-operations-test'));


        const db = getDb();
        if (!db) {
          throw new Error('Database connection not available');
        }

        const collection = db.collection('test_batch_operations');

        // Batch insert
        const batchData = [
          { name: 'Doc 1', type: 'test', createdAt: new Date() },
          { name: 'Doc 2', type: 'test', createdAt: new Date() },
          { name: 'Doc 3', type: 'test', createdAt: new Date() }
        ];

        const insertManyResult = await collection.insertMany(batchData);
        expect(insertManyResult.insertedCount).toBe(3);
        expect(Object.keys(insertManyResult.insertedIds)).toHaveLength(3);

        // Batch update
        const updateManyResult = await collection.updateMany(
          { type: 'test' },
          { $set: { updated: true, updatedAt: new Date() } }
        );
        expect(updateManyResult.matchedCount).toBeGreaterThanOrEqual(3);
        expect(updateManyResult.modifiedCount).toBeGreaterThanOrEqual(3);

        // Test bulk write operations
        const bulkOps = [
          {
            insertOne: {
              document: {
                name: 'Bulk Doc',
                type: 'bulk',
                createdAt: new Date()
              }
            }
          },
          {
            updateOne: {
              filter: { name: 'Bulk Doc' },
              update: { $set: { bulkUpdated: true } }
            }
          }
        ];

        const bulkResult = await collection.bulkWrite(bulkOps);
        expect(bulkResult.insertedCount).toBe(1);

        // Clean up test data
        await collection.deleteMany({ type: { $in: ['test', 'bulk'] } });

        console.log('✅ Real MongoDB Atlas batch operations completed successfully');

      } catch (error) {
        console.error('❌ Real MongoDB Atlas batch operations test failed:', error);
        throw error;
      }
    }, 60000);
  });

  // Real MongoDB Atlas tests
  describe('Real MongoDB Atlas CRUD Operations', () => {
    const ATLAS_URI = 'mongodb+srv://shivampatel0048:BvDiuHw67hBpYSKi@cluster0.uplbr9s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

    beforeEach(async () => {
      // Clean up any existing connections before real tests
      jest.clearAllMocks();
      jest.resetModules();

      // Import fresh modules without mocks for real tests
      jest.unmock('mongoose');
    });

    afterEach(async () => {
      try {
        // Clean up real connections after each test
        const { closeAllConnections } = await import('../index');
        await closeAllConnections();
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should perform real CRUD operations on MongoDB Atlas', async () => {
      try {
        await connectMongo(ATLAS_URI, {
          connectionName: 'atlas-test',
          maxRetries: 3,
          retryDelay: 1000,
          connectionTimeout: 30000
        });

        // Wait for connection to be ready
        await waitForConnection('atlas-test', 15000);

        const db = getDb('atlas-test');
        if (!db) {
          throw new Error('Database connection not available');
        }
        const testCollection = db.collection('connector_test');

        // Insert test document
        const insertResult = await testCollection.insertOne({
          test: true,
          timestamp: new Date(),
          message: 'Test from connector'
        });

        expect(insertResult.insertedId).toBeDefined();

        // Find document
        const document = await testCollection.findOne({ _id: insertResult.insertedId });
        expect(document).toBeDefined();
        expect(document?.test).toBe(true);

        // Update document
        const updateResult = await testCollection.updateOne(
          { _id: insertResult.insertedId },
          { $set: { updated: true } }
        );
        expect(updateResult.modifiedCount).toBe(1);

        // Delete document
        const deleteResult = await testCollection.deleteOne({ _id: insertResult.insertedId });
        expect(deleteResult.deletedCount).toBe(1);

      } catch (error) {
        console.error('❌ Real MongoDB Atlas CRUD test failed:', error);
        throw error;
      }
    }, 60000); // 60 second timeout for real network operations

    it('should handle batch operations on MongoDB Atlas', async () => {
      const {
        connectMongo,
        getDb,
        closeAllConnections,
        waitForConnection
      } = await import('../index');

      try {
        await connectMongo(ATLAS_URI, {
          connectionName: 'atlas-batch-test',
          maxRetries: 3,
          retryDelay: 1000,
          connectionTimeout: 30000
        });

        // Wait for connection to be ready
        await waitForConnection('atlas-batch-test', 15000);

        const db = getDb('atlas-batch-test');
        if (!db) {
          throw new Error('Database connection not available');
        }
        const testCollection = db.collection('connector_batch_test');

        // Insert multiple documents
        const documents = Array.from({ length: 5 }, (_, i) => ({
          index: i,
          data: `test-data-${i}`,
          timestamp: new Date()
        }));

        const insertResult = await testCollection.insertMany(documents);
        expect(insertResult.insertedCount).toBe(5);

        // Find all documents
        const foundDocs = await testCollection.find({}).toArray();
        expect(foundDocs).toHaveLength(5);

        // Update all documents
        const updateResult = await testCollection.updateMany(
          {},
          { $set: { batchUpdated: true } }
        );
        expect(updateResult.modifiedCount).toBe(5);

        // Delete all documents
        const deleteResult = await testCollection.deleteMany({});
        expect(deleteResult.deletedCount).toBe(5);

      } catch (error) {
        console.error('❌ Real MongoDB Atlas batch operations test failed:', error);
        throw error;
      }
    }, 60000);
  });
});
