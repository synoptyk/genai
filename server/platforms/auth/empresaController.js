const Empresa = require('./models/Empresa');

// Obtener todas las empresas
exports.getEmpresas = async (req, res) => {
    try {
        const empresas = await Empresa.find().sort({ createdAt: -1 });
        res.json(empresas);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener empresas', error: error.message });
    }
};

// Obtener una empresa por ID
exports.getEmpresaById = async (req, res) => {
    try {
        const empresa = await Empresa.findById(req.params.id);
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
        res.json(empresa);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la empresa', error: error.message });
    }
};

// Crear una nueva empresa
exports.createEmpresa = async (req, res) => {
    try {
        const { nombre } = req.body;

        // Verificar si existe el nombre
        const existe = await Empresa.findOne({ nombre });
        if (existe) return res.status(400).json({ message: 'Ya existe una empresa con ese nombre' });

        const nuevaEmpresa = await Empresa.create(req.body);

        res.status(201).json(nuevaEmpresa);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la empresa', error: error.message });
    }
};

// Actualizar una empresa
exports.updateEmpresa = async (req, res) => {
    try {
        const empresa = await Empresa.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
        res.json(empresa);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la empresa', error: error.message });
    }
};

// Eliminar una empresa (Solo desactivación lógica recomendada, pero implementamos físico por completitud)
exports.deleteEmpresa = async (req, res) => {
    try {
        const empresa = await Empresa.findByIdAndDelete(req.params.id);
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
        res.json({ message: 'Empresa eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la empresa', error: error.message });
    }
};
