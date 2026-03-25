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
exports.sendCandidateValidationEmail = async (candidato, toEmails) => {
  if (!toEmails) return;
  try {
    const info = await transporter.sendMail({
      from: `"Gen AI · RRHH 360" <${process.env.SMTP_EMAIL}>`,
      to: toEmails,
      subject: `Validación Pendiente: Nuevo Postulante ${candidato.fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4F46E5;">Validación Requerida</h2>
          <p>Estimado equipo,</p>
          <p>El postulante <strong>${candidato.fullName}</strong> (${candidato.rut}) requiere de su aprobación para confirmar su ingreso como <strong>${candidato.position}</strong>.</p>
          <p>Por favor, ingrese a la plataforma en el módulo de Aprobaciones de RRHH para gestionar esta firma.</p>
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;"/>
          <p style="font-size:12px; color:#64748b;">Este es un mensaje automático de Gen AI.</p>
        </div>
      `
    });
    console.log(`📧 Email de validación enviado a: ${toEmails} | ID: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Error enviando email de validación:`, err.message);
  }
};

exports.sendApprovalNotificationEmail = async (candidato, toEmails, type = 'Ingreso', details = null) => {
  if (!toEmails) return;
  try {
    const isVacacion = type !== 'Ingreso';
    const subject = isVacacion 
        ? `✅ Gestión Procesada: ${type} - ${candidato.fullName}`
        : `✅ Firma Finalizada: Ingreso de ${candidato.fullName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #10b981;">Gestión Finalizada</h2>
        <p>Hola,</p>
        <p>Te informamos que la gestión de <strong>${isVacacion ? type : 'Ingreso'}</strong> para el colaborador <strong>${candidato.fullName}</strong> ha sido completamente **APROBADA** por la gerencia.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Colaborador:</strong> ${candidato.fullName}</p>
          <p style="margin: 0 0 10px 0;"><strong>RUT:</strong> ${candidato.rut}</p>
          ${isVacacion ? `<p style="margin: 0;"><strong>Período:</strong> ${new Date(details.fechaInicio).toLocaleDateString()} al ${new Date(details.fechaFin).toLocaleDateString()}</p>` : `<p style="margin: 0;"><strong>Cargo:</strong> ${candidato.position}</p>`}
        </div>

        <p>Ya puedes proceder con los trámites administrativos correspondientes en la plataforma.</p>
        <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;"/>
        <p style="font-size:12px; color:#64748b;">Este es un mensaje automático de Gen AI.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Gen AI · RRHH 360" <${process.env.SMTP_EMAIL}>`,
      to: toEmails,
      subject: subject,
      html: html
    });
    console.log(`📧 Email de aprobación final enviado a: ${toEmails}`);
  } catch (err) {
    console.error(`❌ Error enviando email de aprobación:`, err.message);
  }
};

/**
 * Notificación de Contrato/Anexo pendiente de firma por gerencia
 */
exports.sendContractApprovalEmail = async (documento, toEmails) => {
  if (!toEmails) return;
  try {
    const html = `
      <div style="font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 24px; background: #ffffff;">
        <div style="background: #f0f9ff; color: #0369a1; padding: 8px 16px; border-radius: 99px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 24px; display: inline-block;">
            Validación de Documento
        </div>
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 900; letter-spacing: -0.02em;">Firma Requerida: ${documento.titulo}</h2>
        <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b; line-height: 1.6;">
            Se ha generado un nuevo documento de tipo <strong>${documento.tipo}</strong> que requiere su validación y firma para ser procesado oficialmente.
        </p>
        
        <div style="background-color: #f8fafc; padding: 24px; border-radius: 16px; margin-bottom: 32px; border: 1px solid #f1f5f9;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155;"><strong>Documento:</strong> ${documento.titulo}</p>
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155;"><strong>Tipo:</strong> ${documento.tipo}</p>
          <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Solicitado por:</strong> ${documento.solicitadoPor?.name || 'Administración'}</p>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
            <a href="https://www.genai.cl/rrhh/contratos-dashboard" style="background-color: #0f172a; color: #ffffff; padding: 18px 40px; border-radius: 16px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.2);">REVISAR Y FIRMAR</a>
        </div>

        <hr style="border:none; border-top: 1px solid #f1f5f9; margin: 32px 0;"/>
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Este es un mensaje automático de la suite RRHH 360 de Gen AI.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Gen AI · RRHH 360" <${process.env.SMTP_EMAIL}>`,
      to: toEmails,
      subject: `🖋️ Firma Pendiente: ${documento.titulo}`,
      html: html
    });
    console.log(`📧 Email de aprobación de contrato enviado a: ${toEmails}`);
  } catch (err) {
    console.error(`❌ Error enviando email de aprobación de contrato:`, err.message);
  }
};

exports.sendMeetingInvitationEmail = async (meeting, toEmails) => {
  if (!toEmails) return;
  try {
    const formattedDate = new Date(meeting.date).toLocaleDateString('es-CL');
    const meetingLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call/${meeting.roomId}`;
    
    const info = await transporter.sendMail({
      from: `"Gen AI · Agenda Ejecutiva" <${process.env.SMTP_EMAIL}>`,
      to: toEmails,
      subject: `Invitación: ${meeting.title} - ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4F46E5; margin-top: 0;">📅 Invitación a Reunión</h2>
          <p>Has sido invitado a una reunión ejecutiva por <strong>${meeting.organizerRef.name}</strong>.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Asunto:</strong> ${meeting.title}</p>
            <p style="margin: 0 0 10px 0;"><strong>Fecha:</strong> ${formattedDate}</p>
            <p style="margin: 0 0 10px 0;"><strong>Hora:</strong> ${meeting.startTime} (Duración: ${meeting.duration} min)</p>
            ${meeting.description ? `<p style="margin: 0;"><strong>Descripción:</strong> ${meeting.description}</p>` : ''}
          </div>

          <div style="text-align: center; margin: 30px 0;">
             <a href="${meetingLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Ingresar a la Videollamada</a>
          </div>
          
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;"/>
          <p style="font-size:12px; color:#64748b; text-align: center;">Este es un mensaje automático de la suite de Comunicaciones 360 de Gen AI.</p>
        </div>
      `
    });
    console.log(`📧 Invitación a reunión enviada a: ${toEmails} | ID: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Error enviando invitación de reunión:`, err.message);
  }
};

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

/**
 * Envía notificación espectacular de discrepancia en auditoría
 */
exports.sendAuditoriaDiscrepanciaEmail = async (auditoria, destinatarios) => {
  const { datosAuditado, almacen, detalles, observaciones } = auditoria;
  const fecha = new Date().toLocaleString('es-CL');
  const discrepancies = detalles.filter(d => d.diferencia !== 0);
  
  const itemsHtml = discrepancies.map(d => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px; font-size: 13px; font-weight: 800; color: #0f172a;">${d.producto?.nombre || 'Producto'}</td>
      <td style="padding: 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: center;">${d.stockSistema}</td>
      <td style="padding: 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: center;">${d.conteoFisico}</td>
      <td style="padding: 12px; font-size: 14px; font-weight: 900; color: #e11d48; text-align: center;">${d.diferencia}</td>
    </tr>
  `).join('');

  const mailOptions = {
    from: `"Gen AI · Auditoría 360" <${process.env.SMTP_EMAIL}>`,
    to: destinatarios.join(', '),
    bcc: 'genai@synoptyk.cl',
    subject: `🚨 ALERTA DE DISCREPANCIA — Auditoría de Inventario — ${datosAuditado.nombre}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 650px; margin: auto; background: #ffffff; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);">
        <div style="background: #0f172a; padding: 48px; text-align: center; border-bottom: 4px solid #e11d48;">
          <div style="display: inline-block; padding: 10px 24px; border-radius: 100px; background: rgba(225, 29, 72, 0.1); border: 1px solid rgba(225, 29, 72, 0.3); margin-bottom: 24px;">
            <span style="color: #fb7185; font-size: 11px; font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase;">Protocolo de Seguridad Activo</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px;">Hallazgo de Inventario</h1>
          <p style="color: #94a3b8; margin: 12px 0 0; font-size: 14px; font-weight: 600;">Notificación Automática de Descuento Administrativo</p>
        </div>

        <div style="padding: 48px;">
          <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 24px; padding: 32px; margin-bottom: 40px;">
            <p style="margin: 0 0 8px; font-size: 10px; font-weight: 900; color: #e11d48; text-transform: uppercase; letter-spacing: 0.1em;">Snapshot de la Auditoría</p>
            <h2 style="margin: 0; font-size: 24px; font-weight: 900; color: #9f1239;">${datosAuditado.nombre}</h2>
            <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700; color: #be123c; opacity: 0.8;">${datosAuditado.cargo} · ${datosAuditado.rut}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; background: #f8fafc; border-radius: 20px; overflow: hidden;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 16px; text-align: left; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase;">Producto</th>
                <th style="padding: 16px; text-align: center; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase;">Sistema</th>
                <th style="padding: 16px; text-align: center; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase;">Físico</th>
                <th style="padding: 16px; text-align: center; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase;">Faltante</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="margin-bottom: 40px;">
            <p style="font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.1em;">📍 Lugar de Audit: <span style="color:#0f172a">${almacen?.nombre || 'Bodega Móvil'}</span></p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              <strong>Observaciones Registradas:</strong><br>
              <span style="font-style: italic; color: #64748b;">"${observaciones || 'Sin observaciones adicionales.'}"</span>
            </p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 24px; padding: 24px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600;">La presente auditoría cuenta con las <span style="color:#0f172a">firmas digitales de conformidad</span> capturadas en terreno.</p>
          </div>

          <div style="margin-top: 48px; text-align: center;">
            <a href="https://www.genai.cl/logistica/auditorias" style="display: inline-block; background: #0f172a; color: white; padding: 20px 48px; border-radius: 20px; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">Ver Detalle en Blindaje 360</a>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 32px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 700;">
            Reporte Generado Automáticamente por Gen AI Logistics Engine.<br>
            © 2026 Synoptik • Departamento de Control Interno.
          </p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Alerta de discrepancia enviada a: ${destinatarios.join(', ')}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de discrepancia:', error.message);
    return false;
  }
};

/**
 * Notificación de Solicitud de Compra (Creación, Modificación, Aprobación)
 */
exports.sendPurchaseNotification = async (data) => {
  const { to, subject, title, subtitle, items = [], observation, status, solicitanteNombre } = data;
  
  const itemsHtml = items.map(item => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px; font-size: 13px; font-weight: 800; color: #0f172a;">${item.productoNombre || 'Producto'}</td>
      <td style="padding: 12px; font-size: 13px; font-weight: 600; color: #64748b; text-align: center;">${item.cantidadSolicitada}</td>
      <td style="padding: 12px; font-size: 13px; font-weight: 900; color: #4f46e5; text-align: center;">${item.cantidadAutorizada || '—'}</td>
    </tr>
  `).join('');

  const statusColor = {
    'Revision Gerencia': '#f59e0b',
    'Aprobada': '#16a34a',
    'Rechazada': '#e11d48',
    'Ordenada': '#4f46e5',
  }[status] || '#64748b';

  const mailOptions = {
    from: `"Synoptyk Logística 360" <${process.env.SMTP_EMAIL}>`,
    to: to,
    bcc: 'genai@synoptyk.cl',
    subject: `🛒 ${subject}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 40px; text-align: center;">
          <div style="display: inline-block; padding: 6px 16px; border-radius: 100px; background: rgba(255,255,255,0.08); margin-bottom: 16px;">
            <span style="color: #94a3b8; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em;">Logística 360</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">${title}</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px;">${subtitle}</p>
        </div>
        <div style="padding: 40px;">
          <div style="background: #f8fafc; border-radius: 16px; padding: 20px; margin-bottom: 24px; display: flex; justify-content: space-between;">
            <div>
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Solicitante</p>
              <p style="margin: 0; font-size: 14px; color: #0f172a; font-weight: 700;">${solicitanteNombre}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Estado</p>
              <p style="margin: 0; font-size: 14px; font-weight: 900; color: ${statusColor};">${status}</p>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f8fafc; border-radius: 12px; overflow: hidden;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 12px 16px; text-align: left; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase;">Ítem</th>
                <th style="padding: 12px 16px; text-align: center; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase;">Solicitado</th>
                <th style="padding: 12px 16px; text-align: center; font-size: 10px; font-weight: 900; color: #4f46e5; text-transform: uppercase;">Autorizado</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          ${observation ? `
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 10px; font-weight: 900; color: #b45309; text-transform: uppercase; letter-spacing: 0.1em;">⚠️ Justificación de Modificación</p>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6; font-style: italic;">"${observation}"</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 32px;">
            <a href="https://www.genai.cl/logistica/compras" style="display: inline-block; background: #0f172a; color: white; padding: 16px 36px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Ver en Plataforma →</a>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 11px; color: #94a3b8;">Gen AI · Logística 360 — Notificación Automática</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de compra:', error.message);
    return false;
  }
};

/**
 * Notificación de Checklist Vehicular (Asignación / Devolución)
 */
exports.sendChecklistVehicular = async (data) => {
  const {
    to, tipo, patente, marca, modelo, tecnicoNombre, supervisorNombre,
    kmActual, nivelCombustible, items = {}, fotos = {}, observaciones,
    firmaUrl, firmaSupervisorUrl, qrCodeId, fecha
  } = data;

  const statusIcon = (val) => val === 'OK' || val === 'Bueno' ? '✅' : '⚠️';
  const fechaStr = new Date(fecha || Date.now()).toLocaleString('es-CL', { timeZone: 'America/Santiago' });

  const itemsRows = [
    ['Luces principales', items.luces],
    ['Luces intermitentes', items.lucesIntermitentes],
    ['Luces reversa', items.lucesReversa],
    ['Limpiaparabrisas', items.limpiaParabrisas],
    ['Espejos', items.espejos],
    ['Vidrios', items.vidrios],
    ['Carrocería', items.carroceria],
    ['Neumáticos', items.neumaticos],
    ['Bocina', items.bocina],
    ['Cinturones', items.cinturones],
    ['Aire acondicionado', items.aireAcondicionado],
    ['Nivel aceite', items.nivelAceite],
    ['Nivel refrigerante', items.nivelRefrigerante],
    ['Nivel líquido frenos', items.nivelLiquidoFrenos],
    ['Estado batería', items.estadoBateria],
    ['Chaleco reflectante', items.chalecoReflectante],
    ['Permiso circulación', items.permisoCirculacion],
    ['Seguro obligatorio (SOAP)', items.seguroObligatorio],
    ['Revisión técnica', items.revisionTecnica],
  ].map(([label, val]) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 10px 16px; font-size: 12px; color: #475569;">${label}</td>
      <td style="padding: 10px 16px; font-size: 12px; text-align: center; font-weight: 800; color: ${!val || val === 'OK' ? '#16a34a' : '#e11d48'};">${statusIcon(val)} ${val || 'OK'}</td>
    </tr>
  `).join('');

  const fotosHtml = Object.entries(fotos)
    .filter(([k, v]) => v && k !== 'adicionales')
    .map(([k, v]) => `<img src="${v}" alt="${k}" style="width: 48%; border-radius: 12px; margin-bottom: 8px; border: 2px solid #e2e8f0;" />`)
    .join(' ');

  const colorHeader = tipo === 'Asignación' ? '#4f46e5' : '#0f172a';
  const emojiTipo = tipo === 'Asignación' ? '🚗' : '🏁';

  const mailOptions = {
    from: `"Synoptyk Flota 360" <${process.env.SMTP_EMAIL}>`,
    to: Array.isArray(to) ? to.join(',') : to,
    subject: `${emojiTipo} ${tipo} Vehicular — ${patente} | ${fechaStr}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 680px; margin: auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${colorHeader}, #1e293b); padding: 40px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">${emojiTipo}</div>
          <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">${tipo} Vehicular</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px;">Registro oficial con firma digital</p>
          <div style="display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 100px; padding: 6px 20px; margin-top: 16px;">
            <span style="color: white; font-size: 14px; font-weight: 800; letter-spacing: 0.1em;">${patente}</span>
          </div>
        </div>

        <!-- Meta -->
        <div style="padding: 32px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Vehículo</p>
              <p style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">${marca} ${modelo}</p>
            </div>
            <div>
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Conductor</p>
              <p style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">${tecnicoNombre}</p>
            </div>
            <div>
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Supervisor</p>
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #475569;">${supervisorNombre}</p>
            </div>
            <div>
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Fecha y Hora</p>
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #475569;">${fechaStr}</p>
            </div>
            ${kmActual ? `<div>
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">KM Registrado</p>
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #475569;">${kmActual.toLocaleString()} km</p>
            </div>` : ''}
            ${nivelCombustible ? `<div>
              <p style="margin: 0 0 4px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Combustible</p>
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #475569;">${nivelCombustible}</p>
            </div>` : ''}
          </div>
        </div>

        <!-- Checklist Items -->
        <div style="padding: 32px 40px;">
          <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.1em;">📋 Inspección Técnica</h3>
          <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 12px 16px; text-align: left; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase;">Ítem</th>
                <th style="padding: 12px 16px; text-align: center; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase;">Estado</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>

          ${observaciones ? `
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 16px; padding: 20px; margin-top: 24px;">
            <p style="margin: 0 0 8px; font-size: 10px; font-weight: 900; color: #b45309; text-transform: uppercase;">Observaciones</p>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">${observaciones}</p>
          </div>` : ''}
        </div>

        <!-- Photos -->
        ${fotosHtml ? `
        <div style="padding: 0 40px 32px;">
          <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.1em;">📸 Evidencia Fotográfica</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">${fotosHtml}</div>
        </div>` : ''}

        <!-- Firmas -->
        <div style="padding: 0 40px 32px;">
          <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.1em;">✍️ Firmas Electrónicas · Ley 19.799</h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-right:10px; vertical-align:top;">
                <div style="background:#f8fafc; border-radius:12px; padding:16px; border:1px solid #e2e8f0; text-align:center;">
                  <p style="margin:0 0 10px; font-size:9px; font-weight:800; color:#6366f1; text-transform:uppercase; letter-spacing:2px;">Colaborador / Técnico</p>
                  ${firmaUrl
                    ? `<img src="${firmaUrl}" alt="Firma Colaborador" style="max-width:100%; max-height:80px; border-radius:8px;" /><p style="margin:6px 0 0; font-size:11px; font-weight:700; color:#475569;">${tecnicoNombre}</p>`
                    : `<p style="color:#94a3b8; font-size:11px; padding:16px 0;">Sin firma</p>`}
                </div>
              </td>
              <td width="50%" style="padding-left:10px; vertical-align:top;">
                <div style="background:#f8fafc; border-radius:12px; padding:16px; border:1px solid #e2e8f0; text-align:center;">
                  <p style="margin:0 0 10px; font-size:9px; font-weight:800; color:#10b981; text-transform:uppercase; letter-spacing:2px;">Supervisor</p>
                  ${firmaSupervisorUrl
                    ? `<img src="${firmaSupervisorUrl}" alt="Firma Supervisor" style="max-width:100%; max-height:80px; border-radius:8px;" /><p style="margin:6px 0 0; font-size:11px; font-weight:700; color:#475569;">${supervisorNombre}</p>`
                    : `<p style="color:#94a3b8; font-size:11px; padding:16px 0;">Sin firma</p>`}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- QR Footer -->
        <div style="background: #0f172a; padding: 24px 40px; text-align: center;">
          <p style="margin: 0 0 8px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">ID de Verificación</p>
          <p style="margin: 0; color: white; font-size: 18px; font-weight: 900; letter-spacing: 0.2em; font-family: monospace;">${qrCodeId}</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Checklist ${qrCodeId} enviado a: ${Array.isArray(to) ? to.join(', ') : to}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando checklist vehicular:', error.message);
    return false;
  }
};

/**
 * Envía informe ejecutivo de Inspección HSE (Prevención) a supervisor y trabajador
 * @param {Object} data - datos de la inspección
 */
exports.sendInspeccionEmail = async (data) => {
  const {
    tipo, empresa, ot, nombreTrabajador, rutTrabajador, cargoTrabajador,
    lugarInspeccion, gps, resultado, alertaHse, detalleAlerta,
    cumplimiento, itemsEpp, observaciones,
    inspector, firmaColaborador, emailTrabajador,
    fotoEvidencia, createdAt
  } = data;

  const recipients = [];
  if (inspector?.email) recipients.push(inspector.email);
  if (emailTrabajador) recipients.push(emailTrabajador);
  if (recipients.length === 0) return false;

  const fecha = new Date(createdAt || Date.now()).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const tipoLabel = tipo === 'epp' ? 'Inspección EPP — Equipos de Protección Personal' : 'Inspección de Cumplimiento de Prevención';
  const resultadoColor = resultado === 'Conforme' ? '#10b981' : resultado === 'No Conforme' ? '#ef4444' : '#f59e0b';
  const resultadoBg = resultado === 'Conforme' ? '#ecfdf5' : resultado === 'No Conforme' ? '#fef2f2' : '#fffbeb';

  // Fotos HTML (inline base64, máx 4)
  const fotosHtml = (fotoEvidencia || []).filter(Boolean).slice(0, 4).map((foto, i) => `
    <div style="display:inline-block; width:48%; margin:1%; vertical-align:top;">
      <img src="${foto}" alt="Evidencia ${i+1}" style="width:100%; border-radius:12px; border:2px solid #e2e8f0; object-fit:cover; max-height:200px;" />
      <p style="text-align:center; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin:6px 0 0 0;">Foto ${i+1}</p>
    </div>
  `).join('');

  // Checklist cumplimiento HTML
  const cumplimientoHtml = cumplimiento ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:12px;">
      ${[
        ['AST Vigente (Análisis Seguro de Trabajo)', cumplimiento.tieneAst, cumplimiento.astNumero],
        ['PTS Asignado (Procedimiento de Trabajo Seguro)', cumplimiento.tienePts, cumplimiento.ptsNumero],
        ['EPP Requerido — En buen estado', cumplimiento.tieneEpp && cumplimiento.eppCompleto, null],
        ['Inducción / Charla de Seguridad Realizada', cumplimiento.inductionRealizada, null]
      ].map(([label, ok, extra]) => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 12px; font-size:12px; color:#475569; font-weight:600;">${label}${extra ? ` <span style="color:#6366f1; font-size:10px;">(${extra})</span>` : ''}</td>
          <td style="padding:10px 12px; text-align:right; white-space:nowrap;">
            <span style="background:${ok ? '#ecfdf5' : '#fef2f2'}; color:${ok ? '#10b981' : '#ef4444'}; font-weight:800; font-size:10px; text-transform:uppercase; padding:4px 12px; border-radius:100px;">${ok ? 'Cumple' : 'No Cumple'}</span>
          </td>
        </tr>
      `).join('')}
    </table>
    ${cumplimiento.observacionesCumplimiento ? `<p style="font-size:12px; color:#64748b; margin-top:12px; padding:12px; background:#f8fafc; border-radius:8px; border-left:3px solid #6366f1;"><strong>Observaciones:</strong> ${cumplimiento.observacionesCumplimiento}</p>` : ''}
  ` : '';

  // Checklist EPP HTML
  const eppHtml = itemsEpp && itemsEpp.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:12px;">
      ${itemsEpp.map(item => {
        const ok = item.tiene && item.condicion !== 'Malo';
        const badge = !item.tiene ? 'Ausente' : item.condicion === 'Malo' ? 'Malo' : 'OK';
        const badgeColor = badge === 'OK' ? '#10b981' : badge === 'Malo' ? '#f59e0b' : '#ef4444';
        const badgeBg = badge === 'OK' ? '#ecfdf5' : badge === 'Malo' ? '#fffbeb' : '#fef2f2';
        return `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px; font-size:11px; color:#475569; font-weight:600;">${item.nombre}</td>
            <td style="padding:8px 12px; text-align:right;">
              <span style="background:${badgeBg}; color:${badgeColor}; font-weight:800; font-size:10px; text-transform:uppercase; padding:3px 10px; border-radius:100px;">${badge}</span>
            </td>
          </tr>
        `;
      }).join('')}
    </table>
  ` : '';

  // Firmas HTML
  const firmaInspectorHtml = inspector?.firma ? `
    <div style="text-align:center;">
      <img src="${inspector.firma}" style="max-height:80px; border:1px solid #e2e8f0; border-radius:8px; padding:8px; background:#fff;" alt="Firma Inspector" />
      <p style="font-size:10px; color:#94a3b8; margin:4px 0 0 0; text-transform:uppercase; font-weight:700;">${inspector.nombre || 'Inspector HSE'}</p>
      ${inspector.rut ? `<p style="font-size:9px; color:#cbd5e1; margin:2px 0 0 0;">RUT: ${inspector.rut}</p>` : ''}
      ${inspector.firmaId ? `<p style="font-size:8px; color:#cbd5e1; font-family:monospace; margin:2px 0 0 0;">ID: ${inspector.firmaId}</p>` : ''}
    </div>
  ` : `<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; border:2px dashed #e2e8f0;"><p style="color:#94a3b8; font-size:11px;">Sin firma registrada</p></div>`;

  const firmaColaboradorHtml = firmaColaborador?.firma ? `
    <div style="text-align:center;">
      <img src="${firmaColaborador.firma}" style="max-height:80px; border:1px solid #e2e8f0; border-radius:8px; padding:8px; background:#fff;" alt="Firma Trabajador" />
      <p style="font-size:10px; color:#94a3b8; margin:4px 0 0 0; text-transform:uppercase; font-weight:700;">${firmaColaborador.nombre || nombreTrabajador}</p>
      ${firmaColaborador.rut ? `<p style="font-size:9px; color:#cbd5e1; margin:2px 0 0 0;">RUT: ${firmaColaborador.rut}</p>` : ''}
      ${firmaColaborador.firmaId ? `<p style="font-size:8px; color:#cbd5e1; font-family:monospace; margin:2px 0 0 0;">ID: ${firmaColaborador.firmaId}</p>` : ''}
    </div>
  ` : `<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; border:2px dashed #e2e8f0;"><p style="color:#94a3b8; font-size:11px;">Sin firma registrada</p></div>`;

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
  <body style="margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px; width:100%; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#ef4444 100%); padding:40px 48px; text-align:left;">
              <p style="margin:0 0 8px 0; font-size:10px; font-weight:800; letter-spacing:4px; text-transform:uppercase; color:#ef4444;">Gen AI · Plataforma HSE</p>
              <h1 style="margin:0; font-size:28px; font-weight:900; color:#ffffff; letter-spacing:-0.5px; line-height:1.1;">Informe de Inspección</h1>
              <p style="margin:8px 0 0 0; font-size:13px; color:#94a3b8; font-weight:500;">${tipoLabel}</p>
              <div style="margin-top:20px; display:inline-block; background:${resultadoBg}; border:1.5px solid ${resultadoColor}; border-radius:100px; padding:6px 20px;">
                <span style="font-size:11px; font-weight:800; color:${resultadoColor}; text-transform:uppercase; letter-spacing:2px;">Resultado: ${resultado || 'Observado'}</span>
              </div>
            </td>
          </tr>

          <!-- ALERTA HSE -->
          ${alertaHse ? `
          <tr>
            <td style="background:#fef2f2; padding:16px 48px; border-bottom:1px solid #fecaca;">
              <p style="margin:0; font-size:12px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:1px;">⚠ Alerta HSE Generada</p>
              <p style="margin:4px 0 0 0; font-size:12px; color:#b91c1c;">${detalleAlerta || ''}</p>
            </td>
          </tr>` : ''}

          <tr><td style="padding:40px 48px;">

            <!-- METADATA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:12px; padding:20px; margin-bottom:32px;">
              <tr>
                <td style="padding:4px 16px 4px 0; width:50%;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:2px;">Fecha</p>
                  <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:#1e293b;">${fecha}</p>
                </td>
                <td style="padding:4px 0;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:2px;">Empresa</p>
                  <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:#1e293b;">${empresa || '—'}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px 4px 0;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:2px;">OT / Proyecto</p>
                  <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:#1e293b;">${ot || '—'}</p>
                </td>
                <td style="padding:12px 0 4px 0;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:2px;">Lugar</p>
                  <p style="margin:4px 0 0 0; font-size:13px; font-weight:700; color:#1e293b;">${lugarInspeccion || '—'}</p>
                </td>
              </tr>
              ${gps ? `
              <tr>
                <td colspan="2" style="padding:12px 0 4px 0;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:2px;">GPS</p>
                  <p style="margin:4px 0 0 0; font-size:12px; font-weight:600; color:#6366f1; font-family:monospace;">${gps}</p>
                </td>
              </tr>` : ''}
            </table>

            <!-- TRABAJADOR -->
            <h3 style="margin:0 0 16px 0; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:3px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Trabajador Inspeccionado</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="padding:4px 16px 12px 0; width:33%;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Nombre</p>
                  <p style="margin:4px 0 0 0; font-size:14px; font-weight:800; color:#1e293b;">${nombreTrabajador || '—'}</p>
                </td>
                <td style="padding:4px 16px 12px 0; width:33%;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">RUT</p>
                  <p style="margin:4px 0 0 0; font-size:14px; font-weight:800; color:#1e293b; font-family:monospace;">${rutTrabajador || '—'}</p>
                </td>
                <td style="padding:4px 0 12px 0;">
                  <p style="margin:0; font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Cargo</p>
                  <p style="margin:4px 0 0 0; font-size:14px; font-weight:800; color:#1e293b;">${cargoTrabajador || '—'}</p>
                </td>
              </tr>
            </table>

            <!-- CHECKLIST -->
            <h3 style="margin:0 0 8px 0; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:3px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">
              ${tipo === 'epp' ? 'Revisión de Equipos de Protección Personal' : 'Checklist de Cumplimiento Normativo'}
            </h3>
            ${tipo === 'epp' ? eppHtml : cumplimientoHtml}

            <!-- OBSERVACIONES -->
            ${observaciones ? `
            <div style="margin-top:24px; padding:16px 20px; background:#f8fafc; border-radius:12px; border-left:4px solid #6366f1;">
              <p style="margin:0 0 6px 0; font-size:9px; font-weight:800; color:#6366f1; text-transform:uppercase; letter-spacing:2px;">Observaciones Generales</p>
              <p style="margin:0; font-size:13px; color:#475569; line-height:1.6;">${observaciones}</p>
            </div>` : ''}

            <!-- FOTOS EVIDENCIA -->
            ${fotosHtml ? `
            <div style="margin-top:32px;">
              <h3 style="margin:0 0 16px 0; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:3px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Evidencia Fotográfica</h3>
              <div>${fotosHtml}</div>
            </div>` : ''}

            <!-- FIRMAS -->
            <div style="margin-top:40px;">
              <h3 style="margin:0 0 20px 0; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:3px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Firmas Electrónicas Avanzadas · Ley 19.799</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-right:16px; vertical-align:top;">
                    <div style="background:#f8fafc; border-radius:12px; padding:20px; border:1px solid #e2e8f0;">
                      <p style="margin:0 0 12px 0; font-size:9px; font-weight:800; color:#6366f1; text-transform:uppercase; letter-spacing:2px;">Inspector / Supervisor HSE</p>
                      ${firmaInspectorHtml}
                    </div>
                  </td>
                  <td width="50%" style="padding-left:16px; vertical-align:top;">
                    <div style="background:#f8fafc; border-radius:12px; padding:20px; border:1px solid #e2e8f0;">
                      <p style="margin:0 0 12px 0; font-size:9px; font-weight:800; color:#10b981; text-transform:uppercase; letter-spacing:2px;">Trabajador Inspeccionado</p>
                      ${firmaColaboradorHtml}
                    </div>
                  </td>
                </tr>
              </table>
            </div>

          </td></tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#0f172a; padding:28px 48px; text-align:center;">
              <p style="margin:0 0 4px 0; font-size:11px; font-weight:800; color:#e2e8f0; text-transform:uppercase; letter-spacing:2px;">Gen AI · Plataforma de Gestión Inteligente</p>
              <p style="margin:0; font-size:10px; color:#64748b;">Documento generado automáticamente. Firma amparada por Ley N.º 19.799 sobre Documentos Electrónicos.</p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;

  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'Gen AI HSE'}" <${process.env.SMTP_EMAIL}>`,
    to: [...new Set(recipients)],
    bcc: 'genai@synoptyk.cl',
    subject: `Informe HSE — ${tipoLabel} · ${nombreTrabajador} · ${resultado || 'Observado'}`,
    html
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Informe inspección enviado a: ${recipients.join(', ')}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando informe inspección:', error.message);
    return false;
  }
};
