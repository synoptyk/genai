const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;

    console.log("Creating indexes on 'Numero orden' and 'Número orden'...");
    await db.collection('actividades').createIndex({ "Numero orden": 1 });
    await db.collection('actividades').createIndex({ "Número orden": 1 });

    console.log("Creating indexes on 'RUT del cliente' and 'RUT_del_cliente'...");
    await db.collection('actividades').createIndex({ "RUT del cliente": 1 });
    await db.collection('actividades').createIndex({ "RUT_del_cliente": 1 });

    console.log("Indexes created successfully!");

  } catch (err) {
    console.error("Error creating indexes:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
