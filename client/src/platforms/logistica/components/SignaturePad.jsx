/**
 * SignaturePad.jsx — Backward-compat wrapper around FirmaAvanzada
 * Todos los módulos que importaban SignaturePad ahora obtienen Firma Avanzada automáticamente.
 */
import React, { forwardRef } from 'react';
import FirmaAvanzada from '../../../components/FirmaAvanzada';

const SignaturePad = forwardRef(({ onSave, label, rutFirmante, nombreFirmante, emailFirmante, disabled, canvasClassName }, ref) => {
    // Adaptar el callback: FirmaAvanzada devuelve un objeto payload, el antiguo código esperaba un string base64
    const handleSave = (payload) => {
        if (onSave) {
            // Mantener compatibilidad: si el receptor espera base64 string, pasamos la imagen; si espera el objeto, lo pasamos completo
            onSave(payload);
        }
    };

    return (
        <FirmaAvanzada
            ref={ref}
            label={label || 'Firma Electrónica Avanzada'}
            rutFirmante={rutFirmante}
            nombreFirmante={nombreFirmante}
            emailFirmante={emailFirmante}
            onSave={handleSave}
            disabled={disabled}
        />
    );
});

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
