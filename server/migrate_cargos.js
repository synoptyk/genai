const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';

mongoose.connect(uri)
  .then(async () => {
      console.log("Connected to MongoDB successfully for migration.");
      
      const CargoEquipamiento = mongoose.model('CargoEquipamiento', new mongoose.Schema({
          cargo: String,
          nombreTipoCargo: String,
          empresaRef: mongoose.Schema.Types.ObjectId
      }, { collection: 'cargoequipamientos' }));

      // Find documents where nombreTipoCargo is missing or null
      const list = await CargoEquipamiento.find({
          $or: [
              { nombreTipoCargo: { $exists: false } },
              { nombreTipoCargo: null },
              { nombreTipoCargo: "" }
          ]
      });

      console.log(`Found ${list.length} documents needing migration.`);

      for (const doc of list) {
          doc.nombreTipoCargo = doc.cargo || "Técnico Telecomunicaciones General";
          await doc.save();
          console.log(`Migrated Cargo: "${doc.cargo}" -> nombreTipoCargo: "${doc.nombreTipoCargo}"`);
      }

      console.log("Migration completed.");
      
      // Drop old index if exists
      try {
          await CargoEquipamiento.collection.dropIndex("cargo_1_empresaRef_1");
          console.log("Dropped old unique index cargo_1_empresaRef_1 successfully.");
      } catch (err) {
          console.log("Old index cargo_1_empresaRef_1 did not exist or was already dropped.");
      }

      process.exit(0);
  })
  .catch(err => {
      console.error("Migration error:", err);
      process.exit(1);
  });
