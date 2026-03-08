const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  timeout: 10000, // 10 segundos de timeout
});

// Verificar conexión SMTP al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error de conexión SMTP:', error.message);
  } else {
    console.log('🚀 Servidor de correo listo para enviar mensajes');
  }
});

/**
 * Envía un correo de bienvenida con credenciales de acceso
 * @param {Object} data { email, name, rut, password }
 */
exports.sendWelcomeEmail = async (data) => {
  const { email, name, rut, password, companyName, companyLogo } = data;
  const logoUrl = companyLogo || 'https://www.genai.cl/static/media/logo_placeholder.png'; // Fallback logo
  const finalFromName = companyName ? `${companyName} via Gen AI` : (process.env.FROM_NAME || 'Soporte Gen AI');

  const mailOptions = {
    from: `"${finalFromName}" <${process.env.SMTP_EMAIL}>`,
    to: email,
    bcc: 'genai@synoptyk.cl',
    subject: `¡Bienvenido(a) a ${companyName || 'Gen AI'}! - Tus credenciales de acceso`,
    html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; border: 1px solid #eaeaea; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04);">
            <div style="padding: 48px 48px 0 48px; text-align: left;">
                ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 48px; margin-bottom: 32px; border-radius: 8px;">` : `<h1 style="margin: 0 0 32px 0; font-size: 24px; font-weight: 800; color: #0f172a;">${companyName || 'Portal Corporativo'}</h1>`}
                <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a;">¡Hola, ${name}!</h2>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #334155; line-height: 1.6;">Nos complace darte la bienvenida al equipo. Tu perfil ha sido activado exitosamente y ahora tienes acceso a tu <strong>Portal Colaborador(a)</strong>.</p>
                
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 32px; margin-bottom: 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">TUS CREDENCIALES</p>
                    <p style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a;"><strong>Usuario (Correo):</strong> <span style="font-family: monospace;">${email}</span></p>
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a;"><strong>Contraseña Temporal:</strong> <span style="font-family: monospace;">${password}</span></p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; font-style: italic;">* Te recomendamos cambiar tu contraseña al iniciar sesión por primera vez.</p>
                </div>

                <p style="margin: 0 0 40px 0; font-size: 16px; color: #334155; line-height: 1.6;">Desde tu portal podrás gestionar tu equipamiento, solicitar vacaciones, ver tu producción y mucho más.</p>
                
                <div style="text-align: center; margin-bottom: 48px;">
                    <a href="https://www.genai.cl/login" style="background-color: #4f46e5; color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.25);">ACCEDER AL PORTAL</a>
                </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 500;">Sistema Automatizado de Notificaciones.</p>
            </div>
        </div>
        `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email de bienvenida enviado a: ${email} | ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error enviando email de bienvenida a ${email}:`, error.message);
    if (error.response) console.error('Detalle SMTP:', error.response);
    return false;
  }
};

/**
 * Envía el resumen del AST al correo del trabajador al finalizar el registro
 * @param {Object} ast - Documento AST guardado en MongoDB
 */
exports.sendASTEmail = async (ast) => {
  const destino = ast.emailTrabajador;
  if (!destino) {
    console.warn('⚠️ AST Email: No hay correo del trabajador registrado. Email no enviado.');
    return false;
  }

  const fecha = new Date(ast.fechaCreacion || ast.createdAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  const riesgos = (ast.riesgosSeleccionados || []).join(', ') || 'Ninguno declarado';
  const epp = (ast.eppVerificado || []).join(', ') || 'Ninguno verificado';
  const certificadoId = ast.metadataFirma?.qrId || `AST-${ast._id?.toString().slice(-6).toUpperCase()}`;

  const { companyName, companyLogo } = ast;
  const finalFromName = companyName ? `${companyName} vía Gen AI` : (process.env.FROM_NAME || 'Gen AI · HSE');

  const mailOptions = {
    from: `"${finalFromName}" <${process.env.SMTP_EMAIL}>`,
    to: destino,
    bcc: 'genai@synoptyk.cl',
    subject: `✅ Tu AST ha sido registrada exitosamente — ${certificadoId}`,
    html: `
        <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 620px; margin: auto; background: #f8fafc; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">

          <!-- HEADER -->
          <div style="background: linear-gradient(135deg, #1e40af, #4f46e5); padding: 40px 40px 32px; text-align: center;">
            ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 50px; margin-bottom: 16px;">` : `<div style="background: rgba(255,255,255,0.15); display: inline-block; padding: 12px 28px; border-radius: 100px; margin-bottom: 16px;"><span style="color: white; font-size: 11px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase;">Análisis Seguro de Trabajo</span></div>`}
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">AST Registrada</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px; font-weight: 600;">${companyName || 'Gen AI Corporate'}</p>
          </div>

          <!-- BODY -->
          <div style="padding: 36px 40px; background: white;">
            <p style="color: #334155; font-size: 15px; margin: 0 0 8px;">Hola, <strong>${ast.nombreTrabajador || 'Colaborador/a'}</strong>.</p>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 32px; line-height: 1.6;">
              Tu <strong>Análisis Seguro de Trabajo</strong> ha sido registrada y firmada digitalmente. 
              Conserva este correo como comprobante oficial.
            </p>

            <!-- CERT BADGE -->
            <div style="background: linear-gradient(135deg, #eff6ff, #eef2ff); border: 1px solid #bfdbfe; border-radius: 16px; padding: 20px 24px; margin-bottom: 28px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.2em;">Certificado ID</p>
              <p style="margin: 0; font-size: 22px; font-weight: 900; color: #1e40af; letter-spacing: 0.05em;">${certificadoId}</p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #94a3b8; font-weight: 600;">${fecha}</p>
            </div>

            <!-- DETAILS TABLE -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
              <tr style="background: #f8fafc;">
                <td style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; width: 40%;">OT</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${ast.ot}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">Trabajador</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${ast.nombreTrabajador}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">RUT</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${ast.rutTrabajador || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">Cargo</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${ast.cargoTrabajador || '—'}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">Ubicación</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${ast.calle || ''} ${ast.numero || ''} ${ast.comuna ? `· ${ast.comuna}` : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">GPS</td>
                <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #4f46e5; border-bottom: 1px solid #f1f5f9; font-family: monospace;">${ast.gps || '—'}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Aptitud Física</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 800; color: ${ast.aptitud === 'Si' ? '#16a34a' : '#dc2626'};">${ast.aptitud === 'Si' ? '✅ APTO' : '❌ NO APTO'}</td>
              </tr>
            </table>

            <!-- RIESGOS -->
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 18px 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; font-size: 10px; font-weight: 800; color: #ea580c; text-transform: uppercase; letter-spacing: 0.1em;">⚠️ Riesgos Declarados</p>
              <p style="margin: 0; font-size: 12px; color: #431407; font-weight: 600; line-height: 1.6;">${riesgos}</p>
            </div>

            <!-- EPP -->
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px 20px; margin-bottom: 32px;">
              <p style="margin: 0 0 8px; font-size: 10px; font-weight: 800; color: #16a34a; text-transform: uppercase; letter-spacing: 0.1em;">🦺 EPP Verificado</p>
              <p style="margin: 0; font-size: 12px; color: #14532d; font-weight: 600; line-height: 1.6;">${epp}</p>
            </div>

            <!-- CTA BUTTON -->
            <div style="text-align: center;">
              <a href="https://www.genai.cl/prevencion/dashboard" 
                 style="display: inline-block; background: linear-gradient(135deg, #1d4ed8, #4f46e5); color: white; padding: 16px 40px; border-radius: 100px; text-decoration: none; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 8px 24px rgba(79,70,229,0.3);">
                Ver Dashboard HSE
              </a>
            </div>
          </div>

          <!-- FOOTER -->
          <div style="background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 600;">
              Este es un mensaje automático del sistema Gen AI · HSE Platform.<br>
              © 2026 Synoptik Innovación — Todos los derechos reservados.
            </p>
          </div>
        </div>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 AST Email enviado a: ${destino} | Cert: ${certificadoId}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando AST email:', error.message);
    return false;
  }
};

/**
 * Enviar Notificación de Turno de Operaciones Asignado
 */
module.exports.sendTurnoNotification = async (turno, emailDestino) => {
  try {
    if (!emailDestino) {
      console.warn(`⚠️ Omitiendo envío email: Supervisor sin email destino registrado.`);
      return false;
    }

    const mesDe = new Date(turno.semanaDe).toLocaleDateString('es-CL', { month: 'long', timeZone: 'UTC' }).toUpperCase();

    let filasDias = '';
    turno.rutasDiarias.forEach(d => {
      filasDias += `
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #f1f5f9; width:30%;">${d.diaSemana}</td>
                <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #4f46e5; border-bottom: 1px solid #f1f5f9;">${d.horario.toUpperCase()}</td>
              </tr>
            `;
    });

    const { companyName, companyLogo } = turno;
    const finalFromName = companyName ? `${companyName} Ops` : (process.env.FROM_NAME || 'GEN AI Operations');

    const mailOptions = {
      from: `"${finalFromName}" <${process.env.SMTP_EMAIL}>`,
      to: emailDestino,
      bcc: 'genai@synoptyk.cl',
      subject: `📌 Tu Programación de Turno (Operaciones)`,
      html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 40px 20px; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
                
                <!-- ICON / LOGO -->
                <div style="margin: 0 auto 24px; text-align: center;">
                  ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 50px;">` : `<div style="background: linear-gradient(135deg, #4f46e5, #3b82f6); width: 64px; height: 64px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(79, 70, 229, 0.25);"><span style="font-size: 32px;">📅</span></div>`}
                </div>

                <!-- HDR -->
                <h1 style="color: #0f172a; font-size: 24px; font-weight: 900; margin: 0 0 12px; letter-spacing: -0.02em;">Asignación de Turno</h1>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 32px;">
                  Hola <strong>${turno.supervisorNombre}</strong>, Operaciones ha publicado tu horario de la semana del <strong>${new Date(turno.semanaDe).getUTCDate()} de ${mesDe}</strong>.
                </p>

                <!-- RUTAS TABLE -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; background: #f8fafc; border-radius: 12px; overflow: hidden; text-align:left;">
                  ${filasDias}
                </table>

                <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 24px;">
                  Por favor, ingresa a tu Portal de Supervisión para marcar tu asignación como enterada.
                </p>

                <!-- CTA -->
                <a href="${process.env.FRONTEND_URL || 'https://centraliza-t.cl'}/operaciones/portal-supervision" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; letter-spacing: 0.1em; padding: 16px 32px; border-radius: 16px; text-transform: uppercase;">Aceptar Turno</a>
              </div>
              
              <p style="margin-top: 24px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">
                Gen AI Operaciones • Encriptado & Auditado
              </p>
            </div>
            `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Notificación Turno Enviada:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Notificación Turno Error:', error.message);
    return false;
  }
};

/**
 * Enviar actualización de servicio a Empresa
 */
exports.sendCompanyUpdateEmail = async (empresa, action = 'created', adminEmail = null, changes = null) => {
  const emails = new Set();

  if (empresa.email) emails.add(empresa.email.trim());
  if (adminEmail) emails.add(adminEmail.trim());
  if (empresa.contactosComerciales) empresa.contactosComerciales.forEach(c => c.email && emails.add(c.email.trim()));
  if (empresa.representantesLegales) empresa.representantesLegales.forEach(c => c.email && emails.add(c.email.trim()));

  let toEmails = Array.from(emails).join(', ');
  if (!toEmails) toEmails = 'ceo@synoptyk.cl';

  const actionText = action === 'created' ? 'Activación de Nueva Empresa' : 'Actualización de Servicios Contratados';
  let msg = action === 'created'
    ? `Hemos activado su cuenta corporativa en <strong>Gen AI Platform</strong> y ahora forman parte de nuestro ecosistema. Su plataforma está lista para operar.`
    : `Sus condiciones de servicio y módulos asignados han sido actualizados en nuestra plataforma.`;

  let changesHtml = '';
  if (action === 'updated' && changes && changes.length > 0) {
    msg = `Se han detectado modificaciones recientes en su contrato corporativo o perfil de empresa. A continuación detallamos las actualizaciones procesadas por nuestro equipo:`;
    changesHtml = `
      <div style="margin-top: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #475569;">Modificaciones Registradas:</p>
        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 10px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase;">Campo Alterado</th>
                    <th style="padding: 10px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase;">Nuevo Valor Establecido</th>
                </tr>
            </thead>
            <tbody>
                ${changes.map(c => `
                <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 10px; font-size: 13px; font-weight: 600; color: #334155;">${c.label}</td>
                    <td style="padding: 10px; font-size: 13px; color: #0f172a;">${typeof c.value === 'object' ? JSON.stringify(c.value) : c.value}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
      </div>
    `;
  }

  const activeModLabels = (empresa.modulosActivos || Object.keys(empresa.permisosModulos || {}))
    .map(k => `<span style="display:inline-block; padding: 4px 10px; border-radius: 6px; background: #e0e7ff; color: #3730a3; margin: 4px; font-size: 11px; font-weight:800;">${k.toUpperCase()}</span>`)
    .join('');

  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'Soporte Gen AI'}" <${process.env.SMTP_EMAIL}>`,
    to: toEmails,
    bcc: 'genai@synoptyk.cl',
    subject: `🏢 ${actionText} - ${empresa.nombre}`,
    html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; border: 1px solid #eaeaea; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04);">
            <div style="padding: 48px 48px 0 48px; text-align: left;">
                ${empresa.logo ? `<img src="${empresa.logo}" alt="${empresa.nombre}" style="max-height: 48px; margin-bottom: 32px; border-radius: 8px;">` : `<h1 style="margin: 0 0 32px 0; font-size: 24px; font-weight: 800; color: #0f172a;">${empresa.nombre}</h1>`}
                <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a;">Aviso Corporativo</h2>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #334155; line-height: 1.6;">${msg}</p>
                
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 32px; margin-bottom: 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">ESTADO DEL SERVICIO ACTUAL</p>
                    <p style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a;"><strong>ID Único (Slug):</strong> ${empresa.slug || 'N/A'}</p>
                    <p style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a;"><strong>Límite de Usuarios:</strong> ${empresa.limiteUsuarios || 5} Operadores</p>
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a;"><strong>Plan y Soporte:</strong> Nivel ${empresa.plan ? empresa.plan.toUpperCase() : 'BÁSICO'}</p>
                    <div style="margin-top: 16px;">
                        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #475569;">Módulos Asignados:</p>
                        ${activeModLabels || '<span style="color:#94a3b8; font-style:italic;">Sin módulos definidos</span>'}
                    </div>
                    ${changesHtml}
                </div>

                <p style="margin: 0 0 40px 0; font-size: 15px; color: #64748b; line-height: 1.6;">Su Administrador Maestro ya puede ingresar al sistema y gestionar a su plantilla de usuarios en base al límite asignado.</p>
                
                <div style="text-align: center; margin-bottom: 48px;">
                    <a href="https://www.genai.cl" style="background-color: #4f46e5; color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.25);">INGRESAR A LA PLATAFORMA</a>
                </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 500;">Sistema Automatizado de Notificaciones.</p>
            </div>
        </div>
        `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notificación Empresa enviada a: ${toEmails} | ID: ${info.messageId}`);
    return true;
  } catch (e) {
    console.error(`❌ Error enviando notificación de empresa a ${toEmails}:`, e.message);
    if (e.response) console.error('Detalle SMTP:', e.response);
    return false;
  }
};

/**
 * Envía una notificación profesional cuando se actualiza un perfil de usuario o empresa.
 */
exports.sendUpdateNotification = async ({ email, name, changes, companyName, companyLogo }) => {
  try {
    const fromName = companyName ? `${companyName} via Gen AI` : process.env.FROM_NAME || 'Gen AI Platform';
    const logoUrl = companyLogo || 'https://www.genai.cl/logo-dark.png';

    const changesHtml = changes.map(c =>
      `<tr>
                <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 13px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">${c.label}</td>
                <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #020617; font-weight: 600;">${c.value}</td>
            </tr>`
    ).join('');

    const mailOptions = {
      from: `"${fromName}" <${process.env.SMTP_EMAIL}>`,
      to: email,
      bcc: 'ceo@synoptyk.cl, genai@synoptyk.cl',
      subject: `🔔 Actualización de Perfil - ${companyName || 'Gen AI'}`,
      html: `
                <div style="font-family: 'Inter', -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                        <div style="background: #0f172a; padding: 40px; text-align: center;">
                            <img src="${logoUrl}" alt="Logo" style="max-height: 50px;">
                        </div>
                        <div style="padding: 40px;">
                            <div style="display: inline-block; background: #f0f9ff; color: #0369a1; padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 24px;">
                                Aviso de Seguridad: Actualización
                            </div>
                            <h2 style="color: #0f172a; font-size: 24px; font-weight: 900; margin: 0 0 12px; letter-spacing: -0.02em;">Hola, ${name}</h2>
                            <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 32px;">
                                Te informamos que se han detectado cambios recientes en tu perfil corporativo dentro de la plataforma. A continuación los detalles de la actualización:
                            </p>
                            
                            <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 16px; overflow: hidden;">
                                <thead>
                                    <tr>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; color: #94a3b8; text-transform: uppercase;">Campo</th>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; color: #94a3b8; text-transform: uppercase;">Nuevo Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${changesHtml}
                                </tbody>
                            </table>

                            <p style="margin-top: 32px; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                                Si no has solicitado estos cambios, te recomendamos contactar al administrador del sistema o al departamento de TI de tu empresa de forma inmediata.
                            </p>
                            
                            <div style="margin-top: 40px; text-align: center;">
                                <a href="https://www.genai.cl" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 18px 36px; border-radius: 16px; text-decoration: none; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em;">Ingresar a la Plataforma</a>
                            </div>
                        </div>
                        <div style="background: #f1f5f9; padding: 32px; text-align: center;">
                            <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">
                                Notificación del Sistema
                            </p>
                        </div>
                    </div>
                </div>
            `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Notificación de Actualización Enviada:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación de actualización:', error.message);
    return false;
  }
};

/**
 * Envía el certificado del Checklist Vehicular
 * @param {Object} checklist - Datos del checklist
 * @param {Object} vehiculo - Datos del vehículo
 * @param {Object} tecnico - Datos del técnico
 * @param {Object} supervisor - Datos del supervisor
 */
exports.sendChecklistVehicular = async ({ checklist, vehiculo, tecnico, supervisor }) => {
  const destino = checklist.emailPersonal || tecnico.email;
  const copiaSupervisor = supervisor.email;

  const fecha = new Date(checklist.createdAt || new Date()).toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  const qrId = checklist.qrCodeId || 'CERT-PENDING';
  const finalFromName = supervisor.empresaNombre ? `${supervisor.empresaNombre} Flota` : 'Gen AI · Mi Flotilla';

  const mailOptions = {
    from: `"${finalFromName}" <${process.env.SMTP_EMAIL}>`,
    to: destino,
    cc: copiaSupervisor,
    bcc: 'genai@synoptyk.cl',
    subject: `📋 Certificado de Inspección Vehicular — ${vehiculo.patente} — ${qrId}`,
    html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 620px; margin: auto; background: #ffffff; border-radius: 30px; overflow: hidden; border: 1px solid #f1f5f9; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
          
          <!-- BRANDING -->
          <div style="background: #0f172a; padding: 40px; text-align: center;">
             <div style="display: inline-block; padding: 8px 20px; border-radius: 100px; background: rgba(255,255,255,0.1); margin-bottom: 16px;">
                <span style="color: #38bdf8; font-size: 10px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase;">Certificación de Flota</span>
             </div>
             <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px; font-style: italic;">Smart Checklist OK</h1>
          </div>

          <div style="padding: 40px;">
            <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 32px;">
              Hola <strong>${tecnico.nombre}</strong>,<br>
              Se ha registrado con éxito la inspección técnica del vehículo <strong>${vehiculo.patente}</strong>. Adjuntamos los detalles del certificado digital generado por <strong>${supervisor.nombre}</strong>.
            </p>

            <!-- QR CERTIFICADO -->
            <div style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 24px; padding: 32px; text-align: center; margin-bottom: 32px;">
              <p style="margin: 0 0 16px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em;">ID de Validación única</p>
              <p style="margin: 0; font-size: 32px; font-weight: 900; color: #0f172a; font-family: monospace;">${qrId}</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #3b82f6; font-weight: 700;">${fecha}</p>
            </div>

            <!-- TABLA DE DATOS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Vehículo</td>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.patente})</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Kilometraje</td>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${checklist.checklist?.kilometraje} KM</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Combustible</td>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${checklist.checklist?.combustible}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Proyecto</td>
                <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${checklist.checklist?.proyecto || 'General'}</td>
              </tr>
            </table>

            <div style="background: #f0fdf4; border-radius: 20px; padding: 24px; text-align: center; border: 1px solid #bbf7d0;">
               <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">✅ Certificado Firmado Digitalmente</p>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 32px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 600; line-height: 1.5;">
              Este es un comprobante oficial de entrega/recepción de vehículo.<br>
              Generado por Gen AI · Mi Flotilla Management System.
            </p>
          </div>
        </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Checklist Email enviado a: ${destino} | QR: ${qrId}`);
    return true;
  } catch (err) {
    console.error('❌ Error enviando Checklist email:', err.message);
    return false;
  }
};
