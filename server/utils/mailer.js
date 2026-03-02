const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtppro.zoho.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

/**
 * Envía un correo de bienvenida con credenciales de acceso
 * @param {Object} data { email, name, rut, password }
 */
exports.sendWelcomeEmail = async (data) => {
    const { email, name, rut, password } = data;

    const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Soporte Gen AI'}" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: '¡Bienvenido(a) a Gen AI! - Tus credenciales de acceso',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(to right, #4f46e5, #7c3aed); padding: 40px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.025em;">Gen AI Platform</h1>
                    <p style="margin-top: 8px; opacity: 0.8; font-size: 14px; font-weight: 600;">Centraliza-T Ecosystem</p>
                </div>
                <div style="padding: 40px; color: #1e293b; line-height: 1.6;">
                    <h2 style="margin-top: 0; font-weight: 800; color: #0f172a;">¡Hola, ${name}!</h2>
                    <p>Nos complace darte la bienvenida al equipo. Tu perfil ha sido activado exitosamente y ahora tienes acceso a tu <strong>Portal Colaborador(a)</strong>.</p>
                    
                    <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 24px; margin: 32px 0;">
                        <p style="margin: 0; font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Tus Credenciales</p>
                        <p style="margin: 8px 0; font-size: 14px;"><strong>Usuario (RUT):</strong> ${rut}</p>
                        <p style="margin: 8px 0; font-size: 14px;"><strong>Contraseña Temporal:</strong> ${password}</p>
                        <p style="margin: 16px 0 0 0; font-size: 11px; color: #94a3b8; font-style: italic;">* Te recomendamos cambiar tu contraseña al iniciar sesión por primera vez.</p>
                    </div>

                    <p>Desde tu portal podrás gestionar tu equipamiento, solicitar vacaciones, ver tu producción y mucho más.</p>
                    
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="https://gen-ai.synoptyk.cl/login" style="background: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Acceder al Portal</a>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; 2026 Synoptik Innovación. Todos los derechos reservados.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Email de bienvenida enviado a: ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error enviando email:', error);
        return false;
    }
};
