# Webpack Configuration Guide

This guide explains how to properly configure Next.js to work with next-mongo-connector.

## Quick Setup

The easiest way to configure Next.js is to use our helper function:

```typescript
// next.config.js or next.config.ts
import { createNextConfig } from "next-mongo-connector";

const config = createNextConfig({
  // Your custom Next.js config here
});

export default config;
```

## Manual Configuration

If you need more control, you can configure webpack manually:

```typescript
// next.config.js or next.config.ts
import { createMongoWebpackConfig } from "next-mongo-connector";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Apply MongoDB-specific webpack configuration
    config = createMongoWebpackConfig(config, { isServer });

    // Your custom webpack configuration here

    return config;
  },
};

export default nextConfig;
```

## What Gets Configured

The webpack configuration:

1. Handles optional MongoDB dependencies (kerberos, aws4, etc.)
2. Configures native modules as externals for server-side code
3. Suppresses irrelevant warnings from MongoDB-related modules
4. Ensures proper module resolution in Next.js

## Common Issues

If you see errors related to kerberos, aws4, or other native modules:

1. Make sure you're using our webpack configuration
2. If using TypeScript, ensure you have the following in your tsconfig.json:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

3. Clear your Next.js cache:

```bash
rm -rf .next
```

## Example Projects

Check out our example projects:

- [Basic Next.js App](../examples/basic-nextjs)
- [Full-Stack Next.js App](../examples/fullstack-nextjs)
