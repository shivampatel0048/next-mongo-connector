
# Usage Examples

This document provides comprehensive examples of how to use Next MongoDB Connector in various scenarios and frameworks.

## 🚀 Quick Start Examples

### Basic Connection

```typescript
import { connectMongo, getDb } from "next-mongo-connector";

// Simple connection
await connectMongo();
const db = getDb();

// Use the database
const users = await db.collection("users").find({}).toArray();
```

### With Custom URI

```typescript
import { connectMongo, getDb } from "next-mongo-connector";

await connectMongo("mongodb://localhost:27017/myapp");
const db = getDb();

const result = await db.collection("documents").insertOne({
  title: "Example Document",
  createdAt: new Date(),
});
```

## 🎯 Next.js Examples

### Pages Router (API Routes)

#### Basic API Route

```typescript
// pages/api/users.ts
import { connectMongo, getDb } from "next-mongo-connector";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await connectMongo();
    const db = getDb();

    if (req.method === "GET") {
      const users = await db.collection("users").find({}).toArray();
      res.status(200).json({ users });
    } else if (req.method === "POST") {
      const result = await db.collection("users").insertOne(req.body);
      res.status(201).json({ id: result.insertedId });
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Database connection failed" });
  }
}
```

#### CRUD Operations

```typescript
// pages/api/posts.ts
import { connectMongo, getDb } from "next-mongo-connector";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await connectMongo();
    const db = getDb();
    const collection = db.collection("posts");

    switch (req.method) {
      case "GET":
        const { id } = req.query;
        if (id) {
          const post = await collection.findOne({ _id: new ObjectId(id) });
          if (!post) {
            res.status(404).json({ error: "Post not found" });
            return;
          }
          res.status(200).json({ post });
        } else {
          const posts = await collection.find({}).toArray();
          res.status(200).json({ posts });
        }
        break;

      case "POST":
        const result = await collection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });
        res.status(201).json({ id: result.insertedId });
        break;

      case "PUT":
        const updateId = req.query.id as string;
        if (!updateId) {
          res.status(400).json({ error: "ID is required" });
          return;
        }
        const updateResult = await collection.updateOne(
          { _id: new ObjectId(updateId) },
          { $set: { ...req.body, updatedAt: new Date() } }
        );
        if (updateResult.matchedCount === 0) {
          res.status(404).json({ error: "Post not found" });
          return;
        }
        res.status(200).json({ modified: updateResult.modifiedCount });
        break;

      case "DELETE":
        const { id: deleteId } = req.query;
        const deleteResult = await collection.deleteOne({ _id: deleteId });
        res.status(200).json({ deleted: deleteResult.deletedCount });
        break;

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Database operation failed" });
  }
}
```

### App Router (Route Handlers)

#### Basic Route Handler

```typescript
// app/api/users/route.ts
import { connectMongo, getDb } from "next-mongo-connector";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    await connectMongo();
    const db = getDb();

    const users = await db.collection("users").find({}).toArray();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectMongo();
    const db = getDb();

    const body = await request.json();
    const result = await db.collection("users").insertOne(body);

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Database operation failed" },
      { status: 500 }
    );
  }
}
```

#### Dynamic Routes

```typescript
// app/api/users/[id]/route.ts
import { connectMongo, getDb } from "next-mongo-connector";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongo();
    const db = getDb();

    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(params.id) });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Database operation failed" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongo();
    const db = getDb();

    const body = await request.json();
    const result = await db
      .collection("users")
      .updateOne(
        { _id: params.id },
        { $set: { ...body, updatedAt: new Date() } }
      );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ modified: result.modifiedCount });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Database operation failed" },
      { status: 500 }
    );
  }
}
```

## 🔧 Advanced Examples

### With Mongoose Models

#### User Model

```typescript
// lib/models/User.ts
import { connectMongo, getConnection } from "next-mongo-connector";
import { Schema, model } from "mongoose";

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number, min: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export async function getUserModel() {
  const connection = await connectMongo();
  return connection.models.User || connection.model("User", userSchema);
}
```

#### Using the Model

```typescript
// pages/api/users.ts
import { getUserModel } from "@/lib/models/User";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const User = await getUserModel();

    switch (req.method) {
      case "GET":
        const users = await User.find({ isActive: true });
        res.status(200).json({ users });
        break;

      case "POST":
        const user = new User(req.body);
        const savedUser = await user.save();
        res.status(201).json({ user: savedUser });
        break;

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Database operation failed" });
  }
}
```

### Multi-Database Setup

#### Database Configuration

```typescript
// lib/databases.ts
import { connectMongo, getDb } from "next-mongo-connector";

export async function setupDatabases() {
  // Main database
  await connectMongo(process.env.MAIN_DB_URI, {
    connectionName: "main",
  });

  // Analytics database
  await connectMongo(process.env.ANALYTICS_DB_URI, {
    connectionName: "analytics",
  });

  // Logs database
  await connectMongo(process.env.LOGS_DB_URI, {
    connectionName: "logs",
  });
}

export function getMainDb() {
  return getDb("main");
}

export function getAnalyticsDb() {
  return getDb("analytics");
}

export function getLogsDb() {
  return getDb("logs");
}
```

#### Using Multiple Databases

```typescript
// pages/api/analytics.ts
import { getMainDb, getAnalyticsDb } from "@/lib/databases";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const mainDb = getMainDb();
    const analyticsDb = getAnalyticsDb();

    // Get user data from main database
    const users = await mainDb.collection("users").find({}).toArray();

    // Store analytics data
    await analyticsDb.collection("page_views").insertOne({
      page: "/api/analytics",
      timestamp: new Date(),
      userCount: users.length,
    });

    res.status(200).json({
      users: users.length,
      analytics: "stored",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Database operation failed" });
  }
}
```

### Health Check API

```typescript
// app/api/health/route.ts
import {
  connectMongo,
  healthCheck,
  getPoolStats,
  getConnectionInfo,
} from "next-mongo-connector";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await connectMongo();

    const health = await healthCheck();
    const stats = getPoolStats();
    const info = getConnectionInfo();

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: {
        healthy: health.isHealthy,
        latency: health.latency,
        state: info?.state,
        host: info?.host,
        database: info?.database,
      },
      pool: {
        total: stats.totalConnections,
        active: stats.activeConnections,
        pending: stats.pendingConnections,
        failed: stats.failedConnections,
        connections: stats.connectionNames,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
```

### Connection with Callbacks

```typescript
// lib/database.ts
import { connectMongo, isConnected } from "next-mongo-connector";

export async function setupDatabase() {
  if (isConnected()) {
    console.log("✅ Database already connected");
    return;
  }

  await connectMongo(
    process.env.MONGODB_URI,
    {
      connectionName: "app",
      debug: process.env.NODE_ENV === "development",
      maxRetries: 3,
      retryDelay: 1000,
      connectionTimeout: 10000,
      allowedHosts: ["*.mongodb.net", "localhost"],
    },
    // onConnect callback
    (connection, info) => {
      console.log(`✅ Connected to ${info.database} at ${info.host}`);
      console.log(
        `🔗 Connection established in ${
          Date.now() - info.connectedAt!.getTime()
        }ms`
      );
    },
    // onDisconnect callback
    (info) => {
      console.log(`❌ Disconnected from ${info.connectionName}`);
    },
    // onError callback
    (error, info) => {
      console.error(
        `🚨 Connection error on ${info.connectionName}:`,
        error.message
      );
    }
  );
}
```

### Security Examples

#### URI Validation

```typescript
// lib/security.ts
import { validateURI, validateOptions } from "next-mongo-connector";

export function validateDatabaseConfig(uri: string, options: any) {
  // Validate URI
  const uriValidation = validateURI(uri, [
    "*.mongodb.net",
    "localhost",
    "127.0.0.1",
  ]);

  if (!uriValidation.isValid) {
    throw new Error(`Invalid URI: ${uriValidation.errors.join(", ")}`);
  }

  if (uriValidation.warnings.length > 0) {
    console.warn("URI warnings:", uriValidation.warnings);
  }

  // Validate options
  const optionsValidation = validateOptions(options);
  if (!optionsValidation.isValid) {
    throw new Error(`Invalid options: ${optionsValidation.errors.join(", ")}`);
  }

  return { uriValidation, optionsValidation };
}
```

#### Secure Connection

```typescript
// lib/secure-connection.ts
import { connectMongo } from "next-mongo-connector";

export async function createSecureConnection() {
  return await connectMongo(process.env.MONGODB_URI, {
    options: {
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    },
    allowedHosts: ["*.mongodb.net"],
    validateSSL: true,
    connectionTimeout: 15000,
    maxRetries: 3,
  });
}
```

### Monitoring Examples

#### Connection Monitoring

```typescript
// lib/monitoring.ts
import {
  startConnectionMonitoring,
  batchHealthCheck,
  getPoolStats,
} from "next-mongo-connector";

export class DatabaseMonitor {
  private timer: NodeJS.Timeout | null = null;

  startMonitoring() {
    this.timer = startConnectionMonitoring(
      30000, // Check every 30 seconds
      (connectionName, isHealthy) => {
        console.log(`📊 ${connectionName}: ${isHealthy ? "✅" : "❌"}`);

        if (!isHealthy) {
          // Send alert
          this.sendAlert(connectionName);
        }
      }
    );
  }

  stopMonitoring() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async getStatus() {
    const allHealth = await batchHealthCheck();
    const stats = getPoolStats();

    return {
      health: Object.fromEntries(allHealth),
      pool: stats,
    };
  }

  private sendAlert(connectionName: string) {
    // Implement your alert logic here
    console.error(`🚨 Alert: ${connectionName} is unhealthy`);
  }
}
```

### Error Handling Examples

#### Robust Error Handling

```typescript
// lib/error-handling.ts
import { connectMongo, getDb, isConnected } from "next-mongo-connector";

export class DatabaseService {
  private async ensureConnection() {
    if (!isConnected()) {
      try {
        await connectMongo();
      } catch (error) {
        throw new Error(`Failed to connect to database: ${error.message}`);
      }
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.ensureConnection();
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw new Error(
            `Operation failed after ${maxRetries} attempts: ${lastError.message}`
          );
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    throw lastError!;
  }

  async findUsers(query: any = {}) {
    return this.executeWithRetry(async () => {
      const db = getDb();
      return await db.collection("users").find(query).toArray();
    });
  }

  async createUser(userData: any) {
    return this.executeWithRetry(async () => {
      const db = getDb();
      const result = await db.collection("users").insertOne(userData);
      return result.insertedId;
    });
  }
}
```

### Testing Examples

#### Integration Tests

```typescript
// __tests__/database.test.ts
import {
  connectMongo,
  getDb,
  isConnected,
  waitForConnection,
  closeAllConnections,
  resetConnectorState,
} from "next-mongo-connector";

describe("Database Integration", () => {
  beforeEach(async () => {
    await closeAllConnections();
    resetConnectorState();
  });

  afterAll(async () => {
    await closeAllConnections();
  });

  it("should connect to MongoDB", async () => {
    await connectMongo(process.env.MONGODB_URI);
    await waitForConnection();

    expect(isConnected()).toBe(true);

    const db = getDb();
    expect(db).toBeDefined();
  });

  it("should perform CRUD operations", async () => {
    await connectMongo(process.env.MONGODB_URI);
    await waitForConnection();

    const db = getDb();
    const collection = db.collection("test");

    // Create
    const insertResult = await collection.insertOne({
      name: "Test User",
      email: "test@example.com",
    });
    expect(insertResult.insertedId).toBeDefined();

    // Read
    const user = await collection.findOne({ _id: insertResult.insertedId });
    expect(user?.name).toBe("Test User");

    // Update
    const updateResult = await collection.updateOne(
      { _id: insertResult.insertedId },
      { $set: { name: "Updated User" } }
    );
    expect(updateResult.modifiedCount).toBe(1);

    // Delete
    const deleteResult = await collection.deleteOne({
      _id: insertResult.insertedId,
    });
    expect(deleteResult.deletedCount).toBe(1);
  });
});
```

#### Unit Tests

```typescript
// __tests__/security.test.ts
import { validateURI, validateOptions } from "next-mongo-connector";

describe("Security Validation", () => {
  it("should reject malicious URIs", () => {
    const maliciousUris = [
      'javascript:alert("xss")',
      'data:text/html,<script>alert("xss")</script>',
      "mongodb://host:27017/db?$where=function(){}",
      "mongodb://host:27017/db?$eval=function(){}",
    ];

    maliciousUris.forEach((uri) => {
      const validation = validateURI(uri);
      expect(validation.isValid).toBe(false);
    });
  });

  it("should accept valid URIs", () => {
    const validUris = [
      "mongodb://localhost:27017/test",
      "mongodb+srv://user:pass@cluster.mongodb.net/db",
    ];

    validUris.forEach((uri) => {
      const validation = validateURI(uri);
      expect(validation.isValid).toBe(true);
    });
  });

  it("should validate connection options", () => {
    const validOptions = {
      ssl: true,
      tls: true,
      maxPoolSize: 10,
    };

    const validation = validateOptions(validOptions);
    expect(validation.isValid).toBe(true);
  });
});
```

## 🎯 Framework-Specific Examples

### Express.js

```typescript
// app.js
import express from "express";
import { connectMongo, getDb } from "next-mongo-connector";

const app = express();
app.use(express.json());

// Middleware to ensure database connection
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    req.db = getDb();
    next();
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await req.db.collection("users").find({}).toArray();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Database operation failed" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### Fastify

```typescript
// server.ts
import Fastify from "fastify";
import { connectMongo, getDb } from "next-mongo-connector";

const fastify = Fastify({ logger: true });

// Plugin to handle database connection
fastify.register(async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await connectMongo();
      request.db = getDb();
    } catch (error) {
      reply.status(500).send({ error: "Database connection failed" });
    }
  });
});

fastify.get("/api/users", async (request, reply) => {
  try {
    const users = await request.db.collection("users").find({}).toArray();
    return { users };
  } catch (error) {
    reply.status(500).send({ error: "Database operation failed" });
  }
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err;
});
```

### Koa

```typescript
// app.ts
import Koa from "koa";
import Router from "@koa/router";
import { connectMongo, getDb } from "next-mongo-connector";

const app = new Koa();
const router = new Router();

// Middleware for database connection
app.use(async (ctx, next) => {
  try {
    await connectMongo();
    ctx.db = getDb();
    await next();
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: "Database connection failed" };
  }
});

router.get("/api/users", async (ctx) => {
  try {
    const users = await ctx.db.collection("users").find({}).toArray();
    ctx.body = { users };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: "Database operation failed" };
  }
});

app.use(router.routes());
app.listen(3000);
```

## 🔄 Migration Examples

### From Mongoose Direct Usage

#### Before (Direct Mongoose)

```typescript
// Before: Direct mongoose usage
import mongoose from "mongoose";

export default async function handler(req, res) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.model("User", userSchema);
    const users = await User.find({});
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

#### After (With Next MongoDB Connector)

```typescript
// After: Using next-mongo-connector
import { connectMongo, getConnection } from "next-mongo-connector";

export default async function handler(req, res) {
  try {
    const connection = await connectMongo();
    const User = connection.model("User", userSchema);
    const users = await User.find({});
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### From MongoDB Native Driver

#### Before (Native Driver)

```typescript
// Before: MongoDB native driver
import { MongoClient } from "mongodb";

let client: MongoClient;

export default async function handler(req, res) {
  try {
    if (!client) {
      client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
    }

    const db = client.db();
    const users = await db.collection("users").find({}).toArray();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

#### After (With Next MongoDB Connector)

```typescript
// After: Using next-mongo-connector
import { connectMongo, getDb } from "next-mongo-connector";

export default async function handler(req, res) {
  try {
    await connectMongo();
    const db = getDb();
    const users = await db.collection("users").find({}).toArray();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

**These examples demonstrate the flexibility and power of Next MongoDB Connector across different frameworks and use cases. For more advanced scenarios, refer to the [API Reference](API.md) and [Main Documentation](README.md).**

### Middleware and Rate Limiting

#### Connection Middleware

```typescript
// lib/db-middleware.ts
import { connectMongo, getDb } from "next-mongo-connector";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function withDb(
  handler: (
    request: NextRequest,
    db: ReturnType<typeof getDb>
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      await connectMongo();
      const db = getDb();
      return await handler(request, db);
    } catch (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Database operation failed" },
        { status: 500 }
      );
    }
  };
}

// Usage example:
// app/api/posts/route.ts
import { withDb } from "@/lib/db-middleware";
import { ObjectId } from "mongodb";

export const GET = withDb(async (request, db) => {
  const posts = await db.collection("posts").find({}).toArray();
  return NextResponse.json({ posts });
});
```

#### Rate Limiting with Redis

```typescript
// lib/rate-limit.ts
import { Redis } from "ioredis";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const redis = new Redis(process.env.REDIS_URL);

export async function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  { limit = 10, window = 60 } = {}
) {
  return async (request: NextRequest) => {
    const ip = request.ip ?? "anonymous";
    const key = `rate-limit:${ip}`;

    try {
      const requests = await redis.incr(key);

      if (requests === 1) {
        await redis.expire(key, window);
      }

      if (requests > limit) {
        return NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: {
              "Retry-After": window.toString(),
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }

      const response = await handler(request);
      response.headers.set("X-RateLimit-Limit", limit.toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        (limit - requests).toString()
      );

      return response;
    } catch (error) {
      console.error("Rate limiting error:", error);
      // Fail open - allow the request if rate limiting fails
      return handler(request);
    }
  };
}

// Usage example:
// app/api/posts/route.ts
import { withDb } from "@/lib/db-middleware";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(
  withDb(async (request, db) => {
    const posts = await db.collection("posts").find({}).toArray();
    return NextResponse.json({ posts });
  }),
  { limit: 100, window: 60 } // 100 requests per minute
);
```
