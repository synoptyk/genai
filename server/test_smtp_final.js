const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
    console.log('--- Probando Conexión SMTP ---');
    console.log('Email:', process.env.SMTP_EMAIL);

    let transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    try {
        await transporter.verify();
        console.log('✅ Conexión SMTP exitosa. Zoho aceptó las credenciales.');

        let info = await transporter.sendMail({
            from: `"${process.env.FROM_NAME || 'Gen AI'}" <${process.env.SMTP_EMAIL}>`,
            to: 'ceo@synoptyk.cl',
            subject: 'Prueba de Conexión - Gen AI',
            text: 'Si recibes esto, la configuración de Zoho es correcta.'
        });

        console.log('✅ Correo de prueba enviado:', info.messageId);
    } catch (error) {
        console.error('❌ Error en la conexión/envío:', error.message);
        if (error.response) console.error('Detalle SMTP:', error.response);
    }
}

testSMTP();
