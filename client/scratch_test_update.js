const state = {};

const toHHmm = (val) => val;

const calculateTardanza = (horaReal, turnoHoraEntrada, tolerancia = 0) => {
    if (!horaReal || !turnoHoraEntrada) return 0;
    const [hR, mR] = horaReal.split(':').map(Number);
    const [hE, mE] = turnoHoraEntrada.split(':').map(Number);
    const totalR = hR * 60 + mR;
    const totalE = hE * 60 + mE;
    const diff = totalR - totalE;
    return diff > tolerancia ? diff : 0;
};

const getHorarioDelDia = () => ({ horaEntrada: '08:00', toleranciaTardanza: 10 });

let asistenciaLogs = {
    "123": {
        candidatoId: "123",
        estado: 'Presente',
        minutosTardanza: 30, // Was previously atraso
        horaIngresoDeclarada: '08:30',
        turno: { _id: 'turno1' }
    }
};

const setAsistenciaLogs = (updater) => {
    asistenciaLogs = updater(asistenciaLogs);
};

const handleUpdateLog = (candId, field, val) => {
    setAsistenciaLogs(prev => {
        const current = prev[candId] || {};
        const normalizedVal = (field === 'horaIngresoDeclarada' || field === 'horaSalida') ? toHHmm(val) : val;
        let extra = {};
        if (field === 'estado') {
            if (val !== 'Presente') {
                extra = { minutosTardanza: 0, horasExtraAprobadas: 0, horaSalida: '' };
                if (val === 'Ausente') extra.tipoAusencia = 'Inasistencia Injustificada';
            } else {
                extra = { tipoAusencia: null };
            }
        } else if (field === 'horaIngresoDeclarada') {
            const turno = current.turno;
            if (turno) {
                const horario = getHorarioDelDia();
                if (horario && horario.horaEntrada) {
                    extra.minutosTardanza = calculateTardanza(normalizedVal, horario.horaEntrada, horario.toleranciaTardanza || 0);
                }
            }
        }
        return {
            ...prev,
            [candId]: {
                ...current,
                [field]: normalizedVal,
                ...extra
            }
        };
    });
};

// Simulate clicking "Puntual"
const horaEntrada = '08:00'; // Got from getHorarioDelDia
handleUpdateLog("123", 'estado', 'Presente');
handleUpdateLog("123", 'horaIngresoDeclarada', horaEntrada);

console.log(asistenciaLogs["123"]);
