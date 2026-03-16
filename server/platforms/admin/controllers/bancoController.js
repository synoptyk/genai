const Liquidacion = require('../../rrhh/models/Liquidacion');
const Candidato = require('../../rrhh/models/Candidato');
const { logAction } = require('../../../utils/auditLogger');

exports.exportPagoBanco = async (req, res) => {
    try {
        const { periodo, banco } = req.query; // banco: 'BCI', 'SANTANDER', 'CHILE'
        const empresaId = req.user.empresaRef;

        // Fetch liquidations for the period
        const liquidaciones = await Liquidacion.find({ periodo, empresaRef: empresaId }).populate('trabajadorId').lean();

        if (liquidaciones.length === 0) {
            return res.status(404).json({ message: "No hay liquidaciones procesadas para este periodo." });
        }

        let content = "";
        let fileName = `NOMINA_PAGO_${banco}_${periodo}`;

        switch (banco.toUpperCase()) {
            case 'BCI':
                // BCI Standard Format simulation (Example: 300 chars fixed width)
                liquidaciones.forEach(liq => {
                    const rut = (liq.rutTrabajador || '').replace(/\./g, '').replace(/-/g, '').padStart(10, '0');
                    const nombre = (liq.nombreTrabajador || '').padEnd(30, ' ').substring(0, 30);
                    const monto = Math.round(liq.sueldoLiquido || 0).toString().padStart(12, '0');
                    const cuenta = (liq.trabajadorId?.numeroCuenta || '').padEnd(20, ' ').substring(0, 20);
                    const tipo = (liq.trabajadorId?.tipoCuenta || 'VISTA').padEnd(10, ' ').substring(0, 10);
                    content += `${rut}${nombre}${monto}${cuenta}${tipo}\n`;
                });
                fileName += ".txt";
                break;

            case 'SANTANDER':
                // Santander Multimandato simulation
                liquidaciones.forEach(liq => {
                    const rut = (liq.rutTrabajador || '').replace(/\./g, '').replace(/-/g, '').padStart(9, '0');
                    const dv = (liq.rutTrabajador || '').split('-')[1] || 'K';
                    const monto = Math.round(liq.sueldoLiquido || 0).toString().padStart(15, '0');
                    const cuenta = (liq.trabajadorId?.numeroCuenta || '').padStart(12, '0');
                    content += `00${rut}${dv}${monto}${cuenta}001\n`; // Simplified record
                });
                fileName += ".dat";
                break;

            case 'CHILE':
                // Banco de Chile Formato 400 simulation
                liquidaciones.forEach(liq => {
                    const rut = (liq.rutTrabajador || '').replace(/\./g, '').replace(/-/g, '').padStart(11, '0');
                    const nombre = (liq.nombreTrabajador || '').padEnd(40, ' ').substring(0, 40);
                    const monto = Math.round(liq.sueldoLiquido || 0).toString().padStart(10, '0');
                    content += `DET${rut}${nombre}${monto}30\n`;
                });
                fileName += ".txt";
                break;

            default:
                // Generic CSV
                content = "RUT;Nombre;Monto;Banco;Tipo Cuenta;Nro Cuenta\n";
                liquidaciones.forEach(liq => {
                    content += `${liq.rutTrabajador};${liq.nombreTrabajador};${Math.round(liq.sueldoLiquido)};${liq.trabajadorId?.banco || '—'};${liq.trabajadorId?.tipoCuenta || '—'};${liq.trabajadorId?.numeroCuenta || '—'}\n`;
                });
                fileName += ".csv";
        }

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await logAction(req, 'Bancos', `EXPORT_${banco.toUpperCase()}`, { periodo, recordCount: liquidaciones.length });
        res.status(200).send(content);

    } catch (error) {
        next(error);
    }
};
