const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PlatformUser = require('../platforms/auth/PlatformUser');
const Candidato = require('../platforms/rrhh/models/Candidato');

const initialForm = {
    projectId: '', projectName: '', position: '', ceco: '', area: '', departamento: '', sede: '', jefeDirecto: '',
    idRecursoToa: '', status: 'En Postulación', fuenteCaptacion: 'Captación Directa',
    operationalStartDate: '', 
    clienteId: '', clienteNombre: '',
    contractStartDate: '',
    contractDurationDays: 30,
    nextAddendumDate: '',
    nextAddendumDescription: '',
    contractType: 'PLAZO FIJO',
    contractStep: '1ER CONTRATO',
    fullName: '', rut: '', email: '', phone: '', fechaNacimiento: '', nacionalidad: 'Chilena', gender: 'MASCULINO', // UPPERCASE
    estadoCivil: '', birthPlace: '', idExpiryDate: '',
    address: '', calle: '', numero: '', deptoBlock: '', comuna: '', region: '',
    emergencyContact: '', emergencyPhone: '', emergencyEmail: '',
    sueldoBase: 0, 
    cantidadBonosExtraPermanentes: 0,
    requiresLicence: 'NO',
    licenceExpiryDate: '',
    educationLevel: '',
    situacionLaboralEntrevista: '',
    declaraConflictoInteres: 'NO',
    previsionSalud: 'FONASA', isapreNombre: '', valorPlan: '', monedaPlan: 'UF',
    afp: '', pensionado: 'NO', bloodType: '', allergies: '', chronicDiseases: '',
    tieneCargas: 'NO', cantidadCargasLimitadas: 0,
    tieneDiscapacidad: 'NO', tipoDiscapacidad: '',
    banco: '', tipoCuenta: '', numeroCuenta: '',
    shirtSize: '', pantsSize: '', shoeSize: '', jacketSize: '',
    uniformSize: '', tallaGuantes: '',
    fechaFiniquito: '',
    motivoFiniquito: '',
    profilePic: '', cvUrl: '',
    bonuses: [], bonosConfig: []
};

async function test() {
  try {
    console.log('Connecting...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const user = await PlatformUser.findOne({ email: 'mbarrientos@rambox.cl' });
    const candidateId = '6a30772e6854ee283c82a3c3';
    const c = await Candidato.findById(candidateId).lean();

    const form = { 
        ...initialForm, 
        ...c,
        gender: 'MASCULINO', // FORCE MASCULINO UPPERCASE
        projectId: c.projectId?._id || c.projectId || '',
        empresaRef: c.empresaRef?._id || c.empresaRef || '',
        clienteId: c.clienteId?._id || c.clienteId || '',
        clienteNombre: c.clienteNombre || '',
        fechaNacimiento: c.fechaNacimiento ? new Date(c.fechaNacimiento).toISOString().split('T')[0] : '',
        contractStartDate: (c.contractStartDate || c.fechaInicioContrato) ? new Date(c.contractStartDate || c.fechaInicioContrato).toISOString().split('T')[0] : '',
        contractEndDate: c.contractEndDate ? new Date(c.contractEndDate).toISOString().split('T')[0] : '',
        operationalStartDate: (c.operationalStartDate || c.fechaOperativa || c.fechaEfectivaInicio) ? new Date(c.operationalStartDate || c.fechaOperativa || c.fechaEfectivaInicio).toISOString().split('T')[0] : '',
        idExpiryDate: c.idExpiryDate ? new Date(c.idExpiryDate).toISOString().split('T')[0] : '',
        licenceExpiryDate: c.licenceExpiryDate ? new Date(c.licenceExpiryDate).toISOString().split('T')[0] : '',
        nextAddendumDate: (c.nextAddendumDate || c.fechaProximoHito) ? new Date(c.nextAddendumDate || c.fechaProximoHito).toISOString().split('T')[0] : '',
        fechaFiniquito: c.fechaFiniquito ? new Date(c.fechaFiniquito).toISOString().split('T')[0] : '',
    };

    const dataToSend = { 
        ...form, 
        fullName: form.fullName.toUpperCase(), 
        rut: form.rut,
        status: form.status
    };

    const token = jwt.sign(
      { id: user._id.toString(), version: user.tokenVersion || 0 },
      process.env.JWT_SECRET
    );

    console.log('Sending PUT request with gender=MASCULINO...');
    const apiURL = `http://localhost:5003/api/rrhh/candidatos/${candidateId}`;

    try {
      const response = await axios.put(apiURL, dataToSend, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('PUT SUCCESS! Status:', response.status);
    } catch (err) {
      if (err.response) {
        console.log('PUT FAILED! Status:', err.response.status);
        console.log('Error Data:', JSON.stringify(err.response.data, null, 2));
      } else {
        console.error('Request Error:', err.message);
      }
    }
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
