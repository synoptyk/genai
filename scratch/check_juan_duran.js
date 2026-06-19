const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

async function checkWorker() {
    const client = new MongoClient(mongoUri);
    try {
        console.log('Connecting to MongoDB via MongoClient...');
        await client.connect();
        console.log('Connected successfully!');

        const db = client.db('genai');
        const collection = db.collection('candidatos');

        const worker = await collection.findOne({ rut: /12\.687\.122/i });
        if (!worker) {
            console.log('Worker not found');
        } else {
            console.log('Worker Found:', JSON.stringify(worker, null, 2));
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

checkWorker();
