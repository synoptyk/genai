const Empresa = require('./models/Empresa');
const UserGenAi = require('./UserGenAi');
const { sendCompanyUpdateEmail, sendWelcomeEmail } = require('../../utils/mailer');

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
        const { nombre, adminNombre, adminEmail, adminRut, adminPassword, ...restoDatos } = req.body;

        // Verificar si existe el nombre de la empresa
        const existe = await Empresa.findOne({ nombre });
        if (existe) return res.status(400).json({ message: 'Ya existe una empresa con ese nombre' });

        // Si se nos enviaron datos de admin (flujo de creación desde CEO), verificamos que el email no exista
        if (adminEmail && adminPassword) {
            const adminExiste = await UserGenAi.findOne({ email: adminEmail.toLowerCase().trim() });
            if (adminExiste) {
                return res.status(400).json({ message: 'El correo del administrador ingresado ya está registrado en el sistema' });
            }
        }

        const nuevaEmpresa = await Empresa.create({ nombre, ...restoDatos });

        // Si vienen datos de administrador, lo creamos y vinculamos a esta empresa
        if (adminNombre && adminEmail && adminPassword) {
            // Replicamos el "techo de permisos" que se le dio a la empresa
            const permisosAAsignar = nuevaEmpresa.permisosModulos || new Map();

            const nuevoAdmin = new UserGenAi({
                name: adminNombre.trim(),
                email: adminEmail.toLowerCase().trim(),
                password: adminPassword.trim(),
                rut: adminRut ? adminRut.trim() : undefined,
                empresa: {
                    nombre: nuevaEmpresa.nombre,
                    rut: nuevaEmpresa.rut || '',
                    plan: nuevaEmpresa.plan
                },
                empresaRef: nuevaEmpresa._id,
                cargo: 'Administrador Maestro',
                role: 'admin',
                status: 'Activo',
                tokenVersion: 1,
                permisosModulos: permisosAAsignar
            });

            await nuevoAdmin.save();
            console.log(`✅ Administrador Maestro creado para la empresa ${nuevaEmpresa.nombre}: ${nuevoAdmin.email}`);

            // Enviamos un correo de credenciales
            try {
                await sendWelcomeEmail({
                    email: nuevoAdmin.email,
                    name: nuevoAdmin.name,
                    rut: adminRut || 'RUT No Definido',
                    password: adminPassword.trim(),
                    companyName: nuevaEmpresa.nombre,
                    companyLogo: nuevaEmpresa.logo
                });
            } catch (e) {
                console.error('🔴 Falló el envío de credenciales al admin:', e.message);
            }
        }

        // Enviar correo de alta al CEO y a los contactos de la empresa
        try {
            await sendCompanyUpdateEmail(nuevaEmpresa, 'created');
        } catch (e) {
            console.error('🔴 Falló el correo de notificación de empresa:', e.message);
        }

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

        // Enviar correo de actualización al CEO y a los contactos de la empresa
        try {
            await sendCompanyUpdateEmail(empresa, 'updated');
        } catch (e) {
            console.error('🔴 Error enviando correo de actualización de empresa:', e.message);
        }

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
