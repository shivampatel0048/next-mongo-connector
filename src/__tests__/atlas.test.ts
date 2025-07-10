import { connectMongo, getDb, isConnected, closeAllConnections } from '../index';

describe('MongoDB Atlas Integration', () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shivampatel0048:BvDiuHw67hBpYSKi@cluster0.uplbr9s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
  
  afterEach(async () => {
    await closeAllConnections();
  });

  it('should connect to MongoDB Atlas', async () => {
    const connection = await connectMongo(MONGODB_URI);
    
    expect(connection).toBeDefined();
    expect(isConnected()).toBe(true);
  }, 30000);

  it('should perform basic database operations', async () => {
    await connectMongo(MONGODB_URI);
    const db = getDb();
    
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const testCollection = db.collection('test_collection');
    
    // Insert a test document
    const insertResult = await testCollection.insertOne({
      test: true,
      timestamp: new Date(),
      message: 'Hello from next-mongo-connector!'
    });
    
    expect(insertResult.insertedId).toBeDefined();
    
    // Find the document
    const document = await testCollection.findOne({ _id: insertResult.insertedId });
    expect(document).toBeDefined();
    expect(document?.test).toBe(true);
    
    // Clean up
    await testCollection.deleteOne({ _id: insertResult.insertedId });
  }, 30000);
});
