import {
  validateURI,
  validateOptions,
  connectMongo
} from '../index';
import { ConnectionState } from '../types';

/**
 * Security-focused tests for next-mongo-connector
 * These tests verify security features and protections
 */

describe('Security Tests - next-mongo-connector', () => {
  afterEach(async () => {
    try {
      const { closeAllConnections } = await import('../index');
      await closeAllConnections();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('URI Security Validation', () => {
    test('should reject malicious javascript: URIs', () => {
      const result = validateURI('javascript:alert("XSS")');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Potentially malicious URI detected');
    });

    test('should reject malicious data: URIs', () => {
      const result = validateURI('data:text/html,<script>alert("XSS")</script>');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Potentially malicious URI detected');
    });

    test('should reject non-MongoDB protocols', () => {
      const invalidProtocols = [
        'http://localhost:27017/test',
        'https://localhost:27017/test',
        'ftp://localhost:27017/test',
        'file:///etc/passwd',
        'ldap://localhost:389'
      ];

      invalidProtocols.forEach(uri => {
        const result = validateURI(uri);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('Invalid protocol'))).toBe(true);
      });
    });

    test('should validate host whitelist strictly', () => {
      const allowedHosts = ['*.mongodb.net', 'localhost', 'trusted.com'];

      // These should be rejected
      const maliciousHosts = [
        'mongodb://evil.com:27017/test',
        'mongodb://malicious.example.com:27017/test',
        'mongodb://192.168.1.100:27017/test',
        'mongodb://attacker.mongodb.net.evil.com:27017/test'
      ];

      maliciousHosts.forEach(uri => {
        const result = validateURI(uri, allowedHosts);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('not in the allowed hosts list'))).toBe(true);
      });
    });

    test('should properly handle wildcard host patterns', () => {
      const allowedHosts = ['*.mongodb.net', '*.internal.company.com'];

      // These should be allowed
      const validHosts = [
        'mongodb://cluster0.mongodb.net:27017/test',
        'mongodb://shard1.mongodb.net:27017/test',
        'mongodb://db.internal.company.com:27017/test'
      ];

      validHosts.forEach(uri => {
        const result = validateURI(uri, allowedHosts);
        expect(result.isValid).toBe(true);
      });

      // These should be rejected
      const invalidHosts = [
        'mongodb://mongodb.net:27017/test', // Missing subdomain
        'mongodb://evil.mongodb.net.attacker.com:27017/test', // Subdomain hijack attempt
        'mongodb://company.com:27017/test' // Missing internal.company.com
      ];

      invalidHosts.forEach(uri => {
        const result = validateURI(uri, allowedHosts);
        expect(result.isValid).toBe(false);
      });
    });

    test('should warn about credentials in URI', () => {
      const uriWithCreds = 'mongodb://username:password@localhost:27017/test';
      const result = validateURI(uriWithCreds);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Credentials detected in URI. Consider using environment variables');
    });

    test('should warn about localhost in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = validateURI('mongodb://localhost:27017/test');
      expect(result.warnings).toContain('Using localhost in production environment');

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle malformed URIs gracefully', () => {
      const malformedURIs = [
        'not-a-uri',
        'mongodb://',
        'mongodb://@host:27017/db',
        'mongodb://user:pass@',
        'mongodb+srv://',
        'mongodb://invalid',
        'mongodb://host:invalid-port/db'
      ];

      malformedURIs.forEach(uri => {
        const result = validateURI(uri);
        if (result.isValid) {
          console.log(`❌ URI "${uri}" should be invalid but was accepted`);
        }
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Connection Options Security', () => {
    test('should reject insecure SSL settings in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const insecureOptions = [
        { ssl: false },
        { tls: false },
        { tlsAllowInvalidCertificates: true },
        { tlsAllowInvalidHostnames: true }
      ];

      insecureOptions.forEach(options => {
        const result = validateOptions(options);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should allow flexible SSL settings in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devOptions = {
        ssl: false,
        tlsAllowInvalidCertificates: true
      };

      const result = validateOptions(devOptions);
      expect(result.isValid).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    test('should warn about excessive resource limits', () => {
      const excessiveOptions = {
        maxPoolSize: 1000,
        // Cast to any to test the buffer validation since bufferMaxEntries is not in official types
        ...(({ bufferMaxEntries: 10000 } as any))
      };

      const result = validateOptions(excessiveOptions);
      expect(result.warnings).toContain('Very large connection pool size detected');
      expect(result.warnings).toContain('Very large buffer size detected');
    });

    test('should validate reasonable connection limits', () => {
      const reasonableOptions = {
        maxPoolSize: 10,
        // Cast to any to test the buffer validation since bufferMaxEntries is not in official types
        ...(({ bufferMaxEntries: 100 } as any)),
        ssl: true,
        tls: true
      };

      const result = validateOptions(reasonableOptions);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Connection Security Enforcement', () => {
    test('should reject connection attempts to blacklisted hosts', async () => {
      const maliciousURI = 'mongodb://malicious-host.com:27017/test';
      const allowedHosts = ['localhost', '*.mongodb.net'];

      await expect(
        connectMongo(maliciousURI, { allowedHosts })
      ).rejects.toThrow('Security validation failed');
    });

    test('should enforce security options in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const insecureOptions = {
        options: {
          ssl: false,
          tls: false
        }
      };

      await expect(
        connectMongo('mongodb://localhost:27017/test', insecureOptions)
      ).rejects.toThrow('Options validation failed');

      process.env.NODE_ENV = originalEnv;
    });

    test('should prevent URI injection attempts', async () => {
      const injectionAttempts = [
        'mongodb://localhost:27017/test?ssl=false&readPreference=primary',
        'mongodb://localhost:27017/test#../../../etc/passwd',
        'mongodb://localhost:27017/test?authMechanism=javascript:alert(1)'
      ];

      // Note: These should be caught by URI validation before connection
      injectionAttempts.forEach(async (uri) => {
        await expect(
          connectMongo(uri, { allowedHosts: ['localhost'] })
        ).rejects.toThrow();
      });
    });
  });

  describe('Input Sanitization', () => {
    test('should handle extremely long URIs', () => {
      const longHost = 'a'.repeat(1000);
      const longURI = `mongodb://${longHost}:27017/test`;

      const result = validateURI(longURI);
      // Should either reject or handle gracefully
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    test('should handle special characters in host names', () => {
      const specialCharURIs = [
        'mongodb://host<script>alert(1)</script>:27017/test',
        'mongodb://host"injection":27017/test',
        'mongodb://host&injection=true:27017/test'
      ];

      specialCharURIs.forEach(uri => {
        const result = validateURI(uri);
        // Should handle special characters safely
        expect(typeof result.isValid).toBe('boolean');
      });
    });

    test('should prevent buffer overflow in connection options', () => {
      const maliciousOptions = {
        maxPoolSize: Number.MAX_SAFE_INTEGER,
        // Cast to any to test the buffer validation since these are not in official types
        ...(({
          bufferMaxEntries: Number.MAX_SAFE_INTEGER,
          serverSelectionTimeoutMS: Number.MAX_SAFE_INTEGER
        } as any))
      };

      const result = validateOptions(maliciousOptions);
      // Should detect and warn about extreme values
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Environment-based Security', () => {
    test('should apply stricter validation in production', () => {
      const originalEnv = process.env.NODE_ENV;

      // Test production mode
      process.env.NODE_ENV = 'production';
      let result = validateOptions({ ssl: false });
      expect(result.isValid).toBe(false);

      // Test development mode
      process.env.NODE_ENV = 'development';
      result = validateOptions({ ssl: false });
      expect(result.isValid).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle missing environment variables securely', async () => {
      const originalMongoDB = process.env.MONGODB_URI;
      const originalMongo = process.env.MONGO_URI;

      delete process.env.MONGODB_URI;
      delete process.env.MONGO_URI;

      await expect(connectMongo()).rejects.toThrow('MongoDB URI is required');

      // Restore environment variables
      if (originalMongoDB) process.env.MONGODB_URI = originalMongoDB;
      if (originalMongo) process.env.MONGO_URI = originalMongo;
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose sensitive information in error messages', async () => {
      try {
        await connectMongo('mongodb://user:secret@invalid-host:27017/test', {
          maxRetries: 1,
          retryDelay: 100,
          connectionTimeout: 1000
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Should not contain sensitive information
        expect(errorMessage).not.toContain('user:secret');
        expect(errorMessage).not.toContain('secret');
        expect(errorMessage).not.toContain('user');

        // Should contain generic error information
        expect(
          errorMessage.includes('Failed to connect') ||
          errorMessage.includes('Security validation failed')
        ).toBe(true);
      }
    }, 10000);

    test('should sanitize connection info in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        await connectMongo('mongodb://user:password@localhost:27017/test', {
          maxRetries: 1,
          retryDelay: 100,
          connectionTimeout: 1000
        });
      } catch (error) {
        // Expected to fail
      }

      // Check that sensitive info is not logged
      const logCalls = consoleSpy.mock.calls.flat();
      const errorCalls = consoleErrorSpy.mock.calls.flat();

      const allLogs = [...logCalls, ...errorCalls].join(' ');

      expect(allLogs).not.toContain('user:password');
      expect(allLogs).not.toContain('password');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }, 10000);
  });
});
