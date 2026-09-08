/**
 * Utilidades de fecha en tiempo real para la plataforma Control de Gastos.
 */

/**
 * Retorna el mes y año en curso formateados en español con mayúscula inicial.
 * Ejemplo: "Septiembre 2026", "Octubre 2026"
 */
export function obtenerMesAnioActual(): string {
  const ahora = new Date();
  const mes = ahora.toLocaleDateString('es-GT', { month: 'long' });
  const mesCapitalizado = mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : '';
  const anio = ahora.getFullYear();
  return `${mesCapitalizado} ${anio}`;
}

/**
 * Retorna la fecha de hoy en formato ISO (YYYY-MM-DD) para inicializar inputs de tipo date.
 */
export function obtenerFechaHoyISO(): string {
  return new Date().toISOString().split('T')[0];
}
