const mongoose = require('mongoose');
const URI = 'mongodb+srv://ceo_synoptyk_reclutando:ReclutaSeguro.%23%23@clusterreclutando.im7etzo.mongodb.net/reclutando?retryWrites=true&w=majority&appName=ClusterReclutando';

// Connect to MongoDB
mongoose.connect(URI);

// Define schemas manually to avoid loading files and registering them out of order
const CategoriaSchema = new mongoose.Schema({
    nombre: String,
    icono: String
}, { collection: 'categorias' });
const Categoria = mongoose.models.Categoria || mongoose.model('Categoria', CategoriaSchema);

const ProductoSchema = new mongoose.Schema({
    nombre: String,
    sku: String,
    categoria: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria' }
}, { collection: 'productos' });
const Producto = mongoose.models.Producto || mongoose.model('Producto', ProductoSchema);

const CargoEquipamientoSchema = new mongoose.Schema({
    cargo: String,
    nombreTipoCargo: String,
    items: [{
        productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
        cantidad: Number,
        estadoProducto: String
    }]
}, { collection: 'cargoequipamientos' });
const CargoEquipamiento = mongoose.models.CargoEquipamiento || mongoose.model('CargoEquipamiento', CargoEquipamientoSchema);

async function run() {
    try {
        console.log("Fetching cargo equipamientos...");
        const list = await CargoEquipamiento.find()
            .populate({
                path: 'items.productoRef',
                select: 'nombre sku fotos color tipo marca modelo categoria',
                populate: { path: 'categoria', select: 'nombre icono' }
            });
        
        console.log(`Found ${list.length} cargo equipamientos.`);
        for (const item of list) {
            console.log(`\nCargo: ${item.cargo} (${item.nombreTipoCargo})`);
            console.log(`Items count: ${item.items ? item.items.length : 0}`);
            if (item.items) {
                for (const it of item.items) {
                    const prod = it.productoRef;
                    console.log(` - Product populated?: ${!!prod}`);
                    if (prod) {
                        console.log(`   - Name: ${prod.nombre}`);
                        console.log(`   - SKU: ${prod.sku}`);
                        console.log(`   - Category populated?: ${!!prod.categoria}`);
                        if (prod.categoria) {
                            console.log(`     - Category Name: ${prod.categoria.nombre}`);
                            console.log(`     - Category Icon: ${prod.categoria.icono}`);
                        } else {
                            // Let's query the product directly to see what its category field actually contains
                            const dbProd = await Producto.findById(prod._id);
                            console.log(`     - Raw category in DB for product: ${dbProd ? dbProd.categoria : 'Product not found'}`);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error during execution:", err);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
}

run();
