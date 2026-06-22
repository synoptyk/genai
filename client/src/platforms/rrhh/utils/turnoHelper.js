/**
 * Helper para obtener el horario específico de un turno según el día de la semana.
 * Permite que los módulos de asistencia operativa "conversen" con las excepciones configuradas por día.
 */

const getDayName = (dateStr) => {
    // Manejar casos donde llega Date object o string ISO
    let d;
    if (dateStr instanceof Date) {
        d = new Date(dateStr.getTime());
    } else {
        d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')); // Prevenir timezone shift si es solo YYYY-MM-DD
    }
    
    // Obtener el nombre del día en español (lunes, martes, etc)
    const formatter = new Intl.DateTimeFormat('es-CL', { weekday: 'long' });
    const dayName = formatter.format(d).toLowerCase();
    
    // Mapear al formato que guardamos en la BD ('Lunes', 'Martes', etc)
    const map = {
        'lunes': 'Lunes',
        'martes': 'Martes',
        'miércoles': 'Miércoles',
        'miercoles': 'Miércoles',
        'jueves': 'Jueves',
        'viernes': 'Viernes',
        'sábado': 'Sábado',
        'sabado': 'Sábado',
        'domingo': 'Domingo'
    };
    
    return map[dayName] || dayName;
};

export const getHorarioDelDia = (turno, fecha) => {
    if (!turno) return null;

    const baseHorario = {
        horaEntrada: turno.horaEntrada,
        horaSalida: turno.horaSalida,
        colacionMinutos: turno.colacionMinutos || 0,
        toleranciaTardanza: turno.toleranciaTardanza || 0,
        nombre: turno.nombre
    };

    if (!fecha || !turno.horariosPorDia) {
        return baseHorario;
    }

    const diaSemana = getDayName(fecha);

    // Revisar si existe una configuración específica para este día
    if (turno.horariosPorDia && turno.horariosPorDia[diaSemana] && turno.horariosPorDia[diaSemana].activo) {
        return {
            ...baseHorario,
            horaEntrada: turno.horariosPorDia[diaSemana].horaEntrada || baseHorario.horaEntrada,
            horaSalida: turno.horariosPorDia[diaSemana].horaSalida || baseHorario.horaSalida,
            colacionMinutos: turno.horariosPorDia[diaSemana].colacionMinutos !== undefined 
                ? turno.horariosPorDia[diaSemana].colacionMinutos 
                : baseHorario.colacionMinutos,
            esHorarioEspecial: true,
            dia: diaSemana
        };
    }

    // Si no hay horario especial, pero sabemos el día, retornamos la base indicando el día
    return {
        ...baseHorario,
        esHorarioEspecial: false,
        dia: diaSemana
    };
};
