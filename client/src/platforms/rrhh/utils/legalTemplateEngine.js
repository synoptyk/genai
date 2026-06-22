const formatDateCL = (date = new Date()) => {
    try {
        return new Intl.DateTimeFormat('es-CL').format(date);
    } catch (e) {
        return date.toLocaleDateString();
    }
};

const formatCurrencyCLP = (value = 0) => {
    const amount = Number(value || 0);
    if (Number.isNaN(amount)) return '$0';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
};

export const LEGAL_BLUEPRINTS = [
    {
        key: 'CONTRATO_INDEFINIDO',
        tipo: 'Contrato',
        nombre: 'Contrato de Trabajo Indefinido',
        titulo: 'CONTRATO INDIVIDUAL DE TRABAJO INDEFINIDO',
        description: 'Formato ejecutivo base para contratación indefinida con cláusulas laborales estándar.'
    },
    {
        key: 'CONTRATO_PLAZO_FIJO',
        tipo: 'Contrato',
        nombre: 'Contrato de Trabajo a Plazo Fijo',
        titulo: 'CONTRATO INDIVIDUAL DE TRABAJO A PLAZO FIJO',
        description: 'Incluye vigencia y causal de término en periodo pactado.'
    },
    {
        key: 'ANEXO_REAJUSTE_RENTA',
        tipo: 'Anexo',
        nombre: 'Anexo de Reajuste de Renta',
        titulo: 'ANEXO DE CONTRATO - REAJUSTE DE RENTA',
        description: 'Documento para formalizar actualización de condiciones económicas.'
    },
    {
        key: 'ANEXO_TELETRABAJO',
        tipo: 'Anexo',
        nombre: 'Anexo de Teletrabajo',
        titulo: 'ANEXO DE CONTRATO - MODALIDAD DE TELETRABAJO',
        description: 'Define jornadas, disponibilidad y herramientas en modalidad remota o mixta.'
    },
    {
        key: 'PACTO_CONFIDENCIALIDAD',
        tipo: 'Otro',
        nombre: 'Pacto de Confidencialidad',
        titulo: 'PACTO DE CONFIDENCIALIDAD Y RESGUARDO DE INFORMACION',
        description: 'Compromiso de confidencialidad, propiedad intelectual y manejo de datos.'
    }
];

export const CLAUSE_LIBRARY = [
    {
        key: 'CLAUSULA_PROBIDAD',
        title: 'Probidad y Conducta',
        content: '<p><b>Clausula de probidad y conducta:</b> El colaborador se obliga a mantener un comportamiento intachable, alineado con las politicas internas de etica, prevencion de conflictos de interes y resguardo reputacional de la empresa.</p>'
    },
    {
        key: 'CLAUSULA_CONFIDENCIALIDAD',
        title: 'Confidencialidad',
        content: '<p><b>Clausula de confidencialidad:</b> Toda informacion tecnica, comercial, operativa o estrategica a la que acceda el colaborador sera considerada confidencial y no podra ser divulgada sin autorizacion escrita.</p>'
    },
    {
        key: 'CLAUSULA_DATOS_PERSONALES',
        title: 'Tratamiento de Datos',
        content: '<p><b>Clausula de tratamiento de datos personales:</b> El colaborador autoriza el tratamiento de sus datos personales para fines de administracion laboral, seguridad, cumplimiento legal y continuidad operacional.</p>'
    },
    {
        key: 'CLAUSULA_HERRAMIENTAS',
        title: 'Activos y Herramientas',
        content: '<p><b>Clausula de activos:</b> El colaborador sera responsable del cuidado de equipos, credenciales, uniformes y herramientas entregadas para el ejercicio de sus funciones, debiendo restituirlos en buen estado al termino de la relacion laboral.</p>'
    },
    {
        key: 'CLAUSULA_HORAS_EXTRA',
        title: 'Horas Extraordinarias',
        content: '<p><b>Clausula de horas extraordinarias:</b> Toda hora extraordinaria debera ser previamente autorizada por jefatura directa y sera compensada conforme a la normativa laboral vigente.</p>'
    }
];

const BASE_BY_BLUEPRINT = {
    CONTRATO_INDEFINIDO: `
<p>En {COMUNA}, a {FECHA_ACTUAL}, entre {EMPRESA_NOMBRE}, en adelante la Empresa, y don(na) {NOMBRE_COMPLETO}, RUT {RUT}, en adelante el Colaborador, se celebra el siguiente contrato de trabajo:</p>
<h3>I. Cargo y funciones</h3>
<p>El colaborador se desempenara como {CARGO}, en el area {AREA}, prestando servicios en {SEDE}.</p>
<h3>II. Jornada</h3>
<p>La jornada se ajustara a la normativa vigente y a las necesidades operacionales del servicio.</p>
<h3>III. Remuneracion</h3>
<p>La renta base mensual pactada asciende a {SUELDO_BASE}.</p>
<h3>IV. Inicio de servicios</h3>
<p>La prestacion de servicios comenzara el {FECHA_INICIO}.</p>
<h3>V. Clausulas finales</h3>
<p>Las partes declaran conocer y aceptar las politicas internas, reglamento interno y protocolos de seguridad laboral.</p>
`,
    CONTRATO_PLAZO_FIJO: `
<p>En {COMUNA}, a {FECHA_ACTUAL}, entre {EMPRESA_NOMBRE} y {NOMBRE_COMPLETO}, RUT {RUT}, se acuerda contrato a plazo fijo.</p>
<h3>I. Vigencia</h3>
<p>Este contrato inicia el {FECHA_INICIO} y tendra una duracion de {CONTRACT_DURATION_DAYS} dias, salvo prorroga o termino anticipado conforme a ley.</p>
<h3>II. Cargo</h3>
<p>El colaborador desempenara funciones de {CARGO} en la unidad {AREA}.</p>
<h3>III. Remuneracion</h3>
<p>La remuneracion base mensual asciende a {SUELDO_BASE}.</p>
`,
    ANEXO_REAJUSTE_RENTA: `
<p>Por medio del presente anexo, las partes acuerdan modificar la clausula de remuneracion del contrato vigente del colaborador {NOMBRE_COMPLETO}, RUT {RUT}.</p>
<h3>I. Nueva remuneracion</h3>
<p>Desde {FECHA_ACTUAL}, la renta base mensual sera de {SUELDO_BASE}.</p>
<h3>II. Vigencia del anexo</h3>
<p>El presente instrumento forma parte integrante del contrato original, manteniendose inalterables las demas clausulas.</p>
`,
    ANEXO_TELETRABAJO: `
<p>Las partes acuerdan incorporar modalidad de teletrabajo para {NOMBRE_COMPLETO}, RUT {RUT}, quien se desempena como {CARGO}.</p>
<h3>I. Modalidad</h3>
<p>La prestacion sera remota o mixta, con coordinacion de asistencia presencial segun necesidades operacionales.</p>
<h3>II. Herramientas</h3>
<p>La empresa proveera o validara los recursos tecnologicos necesarios para la continuidad operativa.</p>
<h3>III. Seguridad y salud</h3>
<p>El colaborador se compromete a cumplir los protocolos de ergonomia, prevencion y seguridad de la informacion.</p>
`,
    PACTO_CONFIDENCIALIDAD: `
<p>El colaborador {NOMBRE_COMPLETO}, RUT {RUT}, declara conocer la naturaleza confidencial de la informacion a la que accede en razon de su cargo {CARGO}.</p>
<h3>I. Alcance</h3>
<p>La obligacion de reserva comprende informacion comercial, financiera, operacional, tecnica y de clientes.</p>
<h3>II. Vigencia</h3>
<p>Esta obligacion se mantiene durante la relacion laboral y con posterioridad a su termino.</p>
<h3>III. Incumplimiento</h3>
<p>El incumplimiento de esta obligacion podra activar acciones disciplinarias, civiles o penales conforme a la normativa aplicable.</p>
`
};

const toneWrapper = {
    ejecutivo: (body) => `<div style="font-family: 'Georgia', serif; color: #0f172a;">${body}</div>`,
    formal: (body) => `<div style="font-family: 'Times New Roman', serif; color: #111827;">${body}</div>`,
    moderno: (body) => `<div style="font-family: 'Arial', sans-serif; color: #1e293b;">${body}</div>`
};

export const buildCandidateContext = (candidate, companyName) => {
    const fullName = candidate?.fullName || `${candidate?.nombres || ''} ${candidate?.apellidos || ''}`.trim();
    const birthDateRaw = candidate?.birthDate || candidate?.fechaNacimiento;
    const birthDate = birthDateRaw ? formatDateCL(new Date(birthDateRaw)) : '';
    const contractStartRaw = candidate?.contractStartDate || candidate?.hiring?.startDate;

    return {
        NOMBRE_COMPLETO: fullName || 'COLABORADOR NO DEFINIDO',
        NOMBRES: candidate?.nombres || '',
        APELLIDOS: candidate?.apellidos || '',
        NACIONALIDAD: candidate?.nacionalidad || '',
        FECHA_NACIMIENTO: birthDate,
        ESTADO_CIVIL: candidate?.estadoCivil || '',
        GENERO: candidate?.genero || candidate?.sexo || '',
        RUT: candidate?.rut || '',
        EMAIL: candidate?.email || '',
        TELEFONO: candidate?.phone || '',
        DIRECCION: candidate?.address || '',
        CALLE: candidate?.calle || '',
        NUMERO: candidate?.numero || '',
        COMUNA: candidate?.comuna || '',
        REGION: candidate?.region || '',
        CARGO: candidate?.position || candidate?.hiring?.position || '',
        AREA: candidate?.area || candidate?.departamento || '',
        CECO: candidate?.ceco || '',
        SEDE: candidate?.sede || candidate?.assignedLocation || '',
        PROYECTO: candidate?.projectName || '',
        SUELDO_BASE: formatCurrencyCLP(candidate?.sueldoBase || candidate?.hiring?.salary || 0),
        FECHA_INICIO: contractStartRaw ? formatDateCL(new Date(contractStartRaw)) : formatDateCL(),
        TIPO_CONTRATO: candidate?.contractType || candidate?.hiring?.contractType || '',
        CONTRACT_DURATION_DAYS: candidate?.contractDurationDays || candidate?.hiring?.contractDurationDays || 30,
        AFP: candidate?.afp || '',
        SALUD: candidate?.previsionSalud || '',
        ISAPRE_NOMBRE: candidate?.isapreNombre || '',
        BANCO: candidate?.banco || '',
        TIPO_CUENTA: candidate?.tipoCuenta || '',
        NUMERO_CUENTA: candidate?.numeroCuenta || '',
        TALLA_CAMISA: candidate?.tallaCamisa || candidate?.shirtSize || '',
        TALLA_PANTALON: candidate?.tallaPantalon || candidate?.pantsSize || '',
        TALLA_CALZADO: candidate?.tallaCalzado || candidate?.shoeSize || '',
        EMPRESA_NOMBRE: companyName || 'Portal Corporativo',
        FECHA_ACTUAL: formatDateCL(),
        HORA_ACTUAL: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        USUARIO_ACTUAL: 'Usuario Interno'
    };
};

export const buildPreviewContext = (candidate, companyName) => {
    const runtime = buildCandidateContext(candidate, companyName);
    const demo = {
        NOMBRE_COMPLETO: 'NOMBRE APELLIDO DEMO',
        NOMBRES: 'NOMBRE',
        APELLIDOS: 'APELLIDO',
        RUT: '12.345.678-9',
        EMAIL: 'colaborador@empresa.cl',
        TELEFONO: '+56 9 1234 5678',
        DIRECCION: 'Av. Principal 123',
        CALLE: 'Av. Principal',
        NUMERO: '123',
        COMUNA: 'Santiago',
        REGION: 'Region Metropolitana',
        CARGO: 'Analista Operaciones',
        AREA: 'Recursos Humanos',
        SEDE: 'Casa Matriz',
        SUELDO_BASE: formatCurrencyCLP(850000),
        FECHA_INICIO: formatDateCL(),
        TIPO_CONTRATO: 'Indefinido',
        EMPRESA_NOMBRE: companyName || 'Portal Corporativo'
    };

    return Object.fromEntries(
        Object.entries(runtime).map(([key, value]) => [key, value === '' || value == null ? (demo[key] || `{${key}}`) : value])
    );
};

export const renderTemplateTokens = (content, context = {}) => {
    if (!content) return '';
    return Object.entries(context).reduce((acc, [key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        return acc.replace(regex, value ?? '');
    }, content);
};

export const renderPreviewTokens = (content, context = {}) => {
    if (!content) return '';
    return Object.entries(context).reduce((acc, [key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        return acc.replace(regex, `<b class="text-indigo-600 bg-indigo-50 px-1 rounded">${value ?? ''}</b>`);
    }, content);
};

export const buildTemplateFromBlueprint = ({ blueprintKey, tone = 'ejecutivo', includeClauseKeys = [] }) => {
    const base = BASE_BY_BLUEPRINT[blueprintKey] || BASE_BY_BLUEPRINT.CONTRATO_INDEFINIDO;
    const clauses = CLAUSE_LIBRARY.filter((item) => includeClauseKeys.includes(item.key)).map((item) => item.content).join('\n');
    const body = `${base}\n${clauses}`;
    const wrapper = toneWrapper[tone] || toneWrapper.ejecutivo;
    return wrapper(body);
};

export const getBlueprintByKey = (key) => LEGAL_BLUEPRINTS.find((item) => item.key === key) || LEGAL_BLUEPRINTS[0];

export const getMissingCriticalData = (candidate) => {
    if (!candidate) return ['Seleccionar colaborador'];
    const checks = [
        { ok: !!candidate.rut, label: 'RUT' },
        { ok: !!(candidate.position || candidate?.hiring?.position), label: 'Cargo' },
        { ok: !!(candidate.sueldoBase || candidate?.hiring?.salary), label: 'Sueldo base' },
        { ok: !!(candidate.contractStartDate || candidate?.hiring?.startDate), label: 'Fecha de inicio' },
        { ok: !!candidate.email, label: 'Correo' }
    ];

    return checks.filter((item) => !item.ok).map((item) => item.label);
};

export const getUnresolvedTokens = (content, context = {}) => {
    if (!content) return [];
    const matches = content.match(/\{[A-Z0-9_]+\}/g) || [];
    const unique = [...new Set(matches.map((token) => token.replace(/[{}]/g, '')))];
    return unique.filter((token) => {
        const value = context[token];
        return value === undefined || value === null || value === '';
    });
};

export const replaceUnresolvedTokens = (content, context = {}) => {
    if (!content) return '';
    return content.replace(/\{([A-Z0-9_]+)\}/g, (match, key) => {
        const value = context[key];
        if (value === undefined || value === null || value === '') {
            return `<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:4px;font-weight:700;">${match}</span>`;
        }
        return value;
    });
};
