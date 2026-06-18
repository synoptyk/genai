const fs = require('fs');
const file = 'server/platforms/comunicaciones/webmailRoutes.js';
let content = fs.readFileSync(file, 'utf8');

const newRoutes = `
// Agregar una nueva firma a las guardadas
router.post('/accounts/:id/saved-signatures', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { nombre, cargo, phone, address, logo, website, styleKey, signatureHtml, name } = req.body;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const newSig = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: name || 'Firma Guardada',
            nombre, cargo, phone, address, logo, website, styleKey, signatureHtml
        };
        
        account.savedSignatures.push(newSig);
        await account.save();

        res.json({ success: true, savedSignatures: account.savedSignatures });
    } catch (err) {
        console.error('Error agregando firma guardada:', err);
        res.status(500).json({ message: 'Error agregando firma guardada' });
    }
});

// Eliminar una firma guardada
router.delete('/accounts/:id/saved-signatures/:sigId', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        account.savedSignatures = account.savedSignatures.filter(s => s.id !== req.params.sigId);
        await account.save();

        res.json({ success: true, savedSignatures: account.savedSignatures });
    } catch (err) {
        console.error('Error eliminando firma guardada:', err);
        res.status(500).json({ message: 'Error eliminando firma guardada' });
    }
});
`;

content = content.replace(
    "        res.json({ success: true, signatureProfile: account.signatureProfile });\n    } catch (err) {\n        console.error('Error guardando perfil de firma:', err);\n        res.status(500).json({ message: 'Error guardando perfil de firma' });\n    }\n});",
    "        res.json({ success: true, signatureProfile: account.signatureProfile, savedSignatures: account.savedSignatures });\n    } catch (err) {\n        console.error('Error guardando perfil de firma:', err);\n        res.status(500).json({ message: 'Error guardando perfil de firma' });\n    }\n});\n" + newRoutes
);

fs.writeFileSync(file, content, 'utf8');
console.log('Routes added.');
