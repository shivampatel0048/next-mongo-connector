/**
 * Empty module for replacing optional dependencies
 * Provides mock implementations for all optional MongoDB dependencies
 */

// AWS4 mock
export const sign = () => { };
export const createCredentials = () => ({});

// Kerberos mock
export const initializeClient = () => Promise.resolve();
export const processAuth = () => Promise.resolve();

// BSON-ext mock
export const serialize = (obj: any) => JSON.stringify(obj);
export const deserialize = (str: string) => JSON.parse(str);

// Snappy mock
export const compress = (data: Buffer) => data;
export const uncompress = (data: Buffer) => data;

// SASL mock
export const prepareString = (str: string) => str;

// MongoDB client encryption mock
export const autoEncryption = {
    createKey: () => Buffer.from([]),
    encrypt: (data: Buffer) => data,
    decrypt: (data: Buffer) => data
};

// AWS SDK credential providers mock
export const fromEnv = () => ({});
export const fromInstance = () => ({});
export const fromTemporaryCredentials = () => ({});

// Redis mock (for caching)
export const createClient = () => ({
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(null)
});
