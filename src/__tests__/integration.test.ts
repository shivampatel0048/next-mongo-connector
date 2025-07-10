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
  connectMultiDb,
  getAllConnectionsInfo,
  cleanup,
  resetConnectorState,
  getMongoUri,
  quickConnect,
  waitForConnection,
  ConnectionState,
  getConnection
} from '../index';
import mongoose from 'mongoose';

/**
 * Integration tests with real MongoDB Atlas
 * These tests use the provided MongoDB Atlas URI
 */

describe('Next MongoDB Connector - Real MongoDB Atlas Integration', () => {
  // Use the provided MongoDB Atlas URI
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shivampatel0048:BvDiuHw67hBpYSKi@cluster0.uplbr9s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

  beforeEach(async () => {
    // Clean up any existing connections
    await closeAllConnections();
  });

  afterAll(async () => {
    // Clean up all connections after tests
    await closeAllConnections();
  });

  describe('Basic Connection Tests', () => {
    it('should connect to MongoDB Atlas successfully', async () => {
      await connectMongo(MONGODB_URI);

      expect(isConnected()).toBe(true);

      const info = getConnectionInfo();
      expect(info?.state).toBe(ConnectionState.CONNECTED);
      expect(info?.connectedAt).toBeInstanceOf(Date);
      expect(info?.host).toBeDefined();
      expect(info?.database).toBeDefined();
    }, 30000);

    it('should perform basic database operations', async () => {
      await connectMongo(MONGODB_URI);
      const db = getDb();

      if (!db) {
        throw new Error('Database connection not available');
      }

      // Test collection access
      const testCollection = db.collection('connector_test');

      // Insert a test document
      const insertResult = await testCollection.insertOne({
        test: true,
        timestamp: new Date(),
        message: 'Test from next-mongo-connector',
        environment: 'test'
      });

      expect(insertResult.insertedId).toBeDefined();

      // Find the document
      const document = await testCollection.findOne({ _id: insertResult.insertedId });
      expect(document).toBeDefined();
      expect(document?.test).toBe(true);
      expect(document?.message).toBe('Test from next-mongo-connector');

      // Update the document
      const updateResult = await testCollection.updateOne(
        { _id: insertResult.insertedId },
        { $set: { updated: true, updatedAt: new Date() } }
      );
      expect(updateResult.modifiedCount).toBe(1);

      // Clean up - delete the test document
      const deleteResult = await testCollection.deleteOne({ _id: insertResult.insertedId });
      expect(deleteResult.deletedCount).toBe(1);
    }, 30000);

    it('should handle multiple connections with different names', async () => {
      // Connect to the same database with different connection names
      await connectMongo(MONGODB_URI, {
        connectionName: 'primary'
      });

      await connectMongo(MONGODB_URI, {
        connectionName: 'secondary'
      });

      const stats = getPoolStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.activeConnections).toBe(2);
      expect(stats.connectionNames).toContain('primary');
      expect(stats.connectionNames).toContain('secondary');
    }, 30000);

    it('should perform health checks successfully', async () => {
      await connectMongo(MONGODB_URI);

      const health = await healthCheck();

      expect(health.isHealthy).toBe(true);
      expect(health.connectionName).toBe('default');
      expect(health.state).toBe(ConnectionState.CONNECTED);
      expect(typeof health.latency).toBe('number');
      expect(health.latency).toBeGreaterThan(0);
      expect(health.lastPing).toBeInstanceOf(Date);
    }, 30000);
  });

  describe('Advanced Features', () => {
    it('should handle connection with custom options', async () => {
      await connectMongo(MONGODB_URI, {
        options: {
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 15000,
          socketTimeoutMS: 45000,
        },
        debug: true,
        connectionTimeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      expect(isConnected()).toBe(true);
    }, 30000);

    it('should handle onConnect callback', async () => {
      let callbackExecuted = false;
      let callbackConnection: any = null;
      let callbackInfo: any = null;

      const onConnect = async (connection: any, info: any) => {
        callbackExecuted = true;
        callbackConnection = connection;
        callbackInfo = info;
      };

      await connectMongo(MONGODB_URI, {}, onConnect);
      expect(isConnected()).toBe(true);

      expect(callbackExecuted).toBe(true);
      expect(callbackConnection).toBeDefined();
      expect(callbackInfo).toBeDefined();
      expect(callbackInfo.state).toBe(ConnectionState.CONNECTED);
    }, 30000);

    it('should cache connections and reuse them', async () => {
      // First connection
      await connectMongo(MONGODB_URI);
      const stats1 = getPoolStats();

      // Second connection to same URI should reuse
      await connectMongo(MONGODB_URI);
      const stats2 = getPoolStats();

      expect(stats1.totalConnections).toBe(stats2.totalConnections);
      expect(stats2.totalConnections).toBe(1);
    }, 30000);

    it('should work with Mongoose models', async () => {
      await connectMongo(MONGODB_URI);

      // Define a simple schema using mongoose directly
      const testSchema = new mongoose.Schema({
        name: String,
        email: String,
        createdAt: { type: Date, default: Date.now },
        tags: [String],
        metadata: {
          source: String,
          version: Number
        }
      });

      const TestModel = getConnection().model('ConnectorTest', testSchema);

      // Create a document
      const testData = {
        name: 'Test Document',
        email: 'test@example.com',
        tags: ['connector', 'test', 'atlas'],
        metadata: {
          source: 'integration-test',
          version: 1
        }
      };

      const doc = new TestModel(testData);
      const savedDoc = await doc.save();

      expect(savedDoc._id).toBeDefined();
      expect(savedDoc.name).toBe('Test Document');
      expect(savedDoc.email).toBe('test@example.com');
      expect(savedDoc.createdAt).toBeInstanceOf(Date);
      expect(savedDoc.tags).toHaveLength(3);
      expect(savedDoc.metadata?.source).toBe('integration-test');

      // Find the document
      const foundDoc = await TestModel.findById(savedDoc._id);
      expect(foundDoc).toBeDefined();
      expect(foundDoc?.name).toBe('Test Document');
      expect(foundDoc?.tags).toContain('connector');

      // Update the document
      if (foundDoc?.metadata) {
        foundDoc.metadata.version = 2;
        foundDoc.tags.push('updated');
        await foundDoc.save();

        const updatedDoc = await TestModel.findById(savedDoc._id);
        expect(updatedDoc?.metadata?.version).toBe(2);
        expect(updatedDoc?.tags).toContain('updated');
      }

      // Clean up
      await TestModel.findByIdAndDelete(savedDoc._id);

      // Verify deletion
      const deletedDoc = await TestModel.findById(savedDoc._id);
      expect(deletedDoc).toBeNull();
    }, 30000);
  });

  describe('Multi-Database Features', () => {
    it('should connect to multiple databases', async () => {
      const connections = [
        {
          uri: MONGODB_URI,
          name: 'main',
          options: { connectionName: 'main' }
        },
        {
          uri: MONGODB_URI,
          name: 'secondary',
          options: { connectionName: 'secondary' }
        }
      ];

      const connectionMap = await connectMultiDb(connections);

      // Wait for connections to be ready
      expect(connectionMap.size).toBe(2);
      expect(connectionMap.has('main')).toBe(true);
      expect(connectionMap.has('secondary')).toBe(true);

      // Test that both connections work
      expect(isConnected('main')).toBe(true);
      expect(isConnected('secondary')).toBe(true);
    }, 30000);

    it('should get all connection information', async () => {
      await connectMongo(MONGODB_URI, { connectionName: 'test1' });
      await connectMongo(MONGODB_URI, { connectionName: 'test2' });

      const allInfo = getAllConnectionsInfo();

      expect(allInfo.size).toBe(2);
      expect(allInfo.has('test1')).toBe(true);
      expect(allInfo.has('test2')).toBe(true);

      const test1Info = allInfo.get('test1');
      expect(test1Info?.state).toBe(ConnectionState.CONNECTED);
      expect(test1Info?.connectionName).toBe('test1');
    }, 30000);
  });

  describe('Utility Functions', () => {
    it('should validate URI correctly for MongoDB Atlas', () => {
      const validation = validateURI(MONGODB_URI);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Should have warnings for credentials in URI
      expect(validation.warnings.length).toBeGreaterThanOrEqual(1);
      expect(validation.warnings[0]).toContain('Credentials detected in URI');
    });

    it('should get MongoDB URI from environment or fallback', () => {
      // Test with environment variable
      process.env.MONGODB_URI = MONGODB_URI;
      const uri1 = getMongoUri();
      expect(uri1).toBe(MONGODB_URI);

      // Test with fallback
      delete process.env.MONGODB_URI;
      const uri2 = getMongoUri(MONGODB_URI);
      expect(uri2).toBe(MONGODB_URI);

      // Restore environment variable
      process.env.MONGODB_URI = MONGODB_URI;
    });

    it('should support quick connect', async () => {
      process.env.MONGODB_URI = MONGODB_URI;

      await quickConnect('quick-test');
      expect(isConnected('quick-test')).toBe(true);

      const info = getConnectionInfo('quick-test');
      expect(info?.connectionName).toBe('quick-test');
    }, 30000);

    it('should handle cleanup properly', async () => {
      await connectMongo(MONGODB_URI);
      expect(isConnected()).toBe(true);

      await cleanup();

      expect(isConnected()).toBe(false);
      expect(getPoolStats().totalConnections).toBe(0);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent connections', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          connectMongo(MONGODB_URI, {
            connectionName: `concurrent-${i}`
          })
        );
      }

      await Promise.all(promises);

      // Wait for all connections to be ready
      for (let i = 0; i < 5; i++) {
        expect(isConnected(`concurrent-${i}`)).toBe(true);
      }

      const stats = getPoolStats();
      expect(stats.totalConnections).toBe(5);
      expect(stats.activeConnections).toBe(5);
    }, 30000);

    it('should maintain connection state correctly', async () => {
      // Test connection lifecycle
      expect(isConnected()).toBe(false);

      await connectMongo(MONGODB_URI);
      expect(isConnected()).toBe(true);

      const info = getConnectionInfo();
      expect(info?.state).toBe(ConnectionState.CONNECTED);
      expect(info?.connectedAt).toBeInstanceOf(Date);
      expect(info?.host).toBeDefined();
      expect(info?.database).toBeDefined();

      await closeConnection();
      expect(isConnected()).toBe(false);
    }, 30000);

    it('should handle graceful disconnection', async () => {
      await connectMongo(MONGODB_URI);
      expect(isConnected()).toBe(true);

      await closeConnection();
      expect(isConnected()).toBe(false);

      const stats = getPoolStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
    }, 30000);

    it('should handle database operations under load', async () => {
      await connectMongo(MONGODB_URI);
      const db = getDb();

      if (!db) {
        throw new Error('Database connection not available');
      }

      const testCollection = db.collection('load_test');

      // Perform multiple operations concurrently
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          testCollection.insertOne({
            index: i,
            data: `test-data-${i}`,
            timestamp: new Date(),
            random: Math.random()
          })
        );
      }

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.insertedId).toBeDefined();
      });

      // Find all inserted documents
      const documents = await testCollection.find({
        index: { $gte: 0, $lt: 10 }
      }).toArray();

      expect(documents).toHaveLength(10);

      // Clean up
      await testCollection.deleteMany({
        index: { $gte: 0, $lt: 10 }
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid MongoDB URI', async () => {
      await expect(
        connectMongo('mongodb://invalid-host:27017/test', {
          maxRetries: 1,
          retryDelay: 100,
          connectionTimeout: 1000
        })
      ).rejects.toThrow();
    }, 15000);

    it('should handle malformed URI', async () => {
      await expect(
        connectMongo('invalid-uri')
      ).rejects.toThrow('Security validation failed');
    });

    it('should handle database errors gracefully', async () => {
      await connectMongo(MONGODB_URI);
      const db = getDb();

      if (!db) {
        throw new Error('Database connection not available');
      }

      // Try to perform an operation on a collection with invalid name
      try {
        await db.collection('').findOne({});
      } catch (error) {
        expect(error).toBeDefined();
        // Connection should still be active
        expect(isConnected()).toBe(true);
      }
    }, 30000);

    it('should handle connection timeout', async () => {
      await expect(
        connectMongo(MONGODB_URI, {
          connectionTimeout: 1, // Very short timeout
          maxRetries: 1,
          retryDelay: 1
        })
      ).rejects.toThrow();
    }, 15000);
  });

  describe('Security Validation', () => {
    it('should validate secure MongoDB Atlas connection', async () => {
      await connectMongo(MONGODB_URI, {
        options: {
          ssl: true,
          tls: true,
          tlsAllowInvalidCertificates: false,
          tlsAllowInvalidHostnames: false
        },
        validateSSL: true
      });

      expect(isConnected()).toBe(true);

      const info = getConnectionInfo();
      expect(info?.state).toBe(ConnectionState.CONNECTED);
    }, 30000);

    it('should handle host whitelist validation', async () => {
      // This should pass for MongoDB Atlas
      await expect(
        connectMongo(MONGODB_URI, {
          allowedHosts: ['*.mongodb.net', 'cluster0.uplbr9s.mongodb.net']
        })
      ).resolves.toBeDefined();

      // This should fail
      await expect(
        connectMongo(MONGODB_URI, {
          allowedHosts: ['localhost', 'malicious.com']
        })
      ).rejects.toThrow('not in the allowed hosts list');
    }, 30000);
  });
});