const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Actividad = require('./platforms/agentetelecom/models/Actividad');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const collection = mongoose.connection.collection('actividades');
    
    console.log("Creating index on 'Número de Petición'...");
    await collection.createIndex({ "Número de Petición": 1 });
    
    console.log("Creating index on 'Número_de_Petición'...");
    await collection.createIndex({ "Número_de_Petición": 1 });
    
    console.log("Creating index on 'peticion'...");
    await collection.createIndex({ "peticion": 1 });

    console.log("All indexes created successfully!");

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
