// Utilidad para calcular el bono imponible según la tabla de tramos y puntos no calculables

/**
 * Calcula el bono imponible alcanzado según la producción y la tabla de tramos.
 * @param {number} puntosTotales - Puntos totales producidos.
 * @param {number} puntosNoCalculables - Puntos no calculables (se restan antes de aplicar tramo).
 * @param {Array} tramos - Array de tramos [{ desde, hasta, valor }]. "hasta" puede ser null para el último tramo.
 * @returns {number} Bono imponible alcanzado.
 */
export function calcularBonoImponible(puntosTotales, puntosNoCalculables, tramos) {
  const puntosCalculables = Math.max(0, puntosTotales - puntosNoCalculables);
  for (let i = 0; i < tramos.length; i++) {
    const tramo = tramos[i];
    if (
      puntosCalculables >= tramo.desde &&
      (tramo.hasta === null || puntosCalculables <= tramo.hasta)
    ) {
      return tramo.valor;
    }
  }
  return 0;
}

// Ejemplo de uso:
// const tramos = [
//   { desde: 0, hasta: 95, valor: 0 },
//   { desde: 96, hasta: 126, valor: 475 },
//   { desde: 127, hasta: 147, valor: 950 },
//   { desde: 148, hasta: 163, valor: 2660 },
//   { desde: 164, hasta: null, valor: 3040 },
// ];
// calcularBonoImponible(150, 95, tramos) // Devuelve el valor del tramo correspondiente
