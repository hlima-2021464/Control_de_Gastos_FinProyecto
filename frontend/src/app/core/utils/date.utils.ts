import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Utilidades de fecha en tiempo real para la plataforma Control de Gastos.
 */

/**
 * Retorna el mes y año en curso formateados en español con mayúscula inicial.
 * Ejemplo: "Septiembre 2026", "Octubre 2026"
 */
export function obtenerMesAnioActual(fecha: Date = new Date()): string {
  const mes = fecha.toLocaleDateString('es-GT', { month: 'long' });
  const mesCapitalizado = mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : '';
  const anio = fecha.getFullYear();
  return `${mesCapitalizado} ${anio}`;
}

/**
 * Retorna la fecha completa actual con día de la semana en español.
 * Ejemplo: "Martes, 15 de Septiembre de 2026"
 */
export function obtenerFechaCompletaHoy(fecha: Date = new Date()): string {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const diaSemana = dias[fecha.getDay()];
  const diaMes = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear();

  return `${diaSemana}, ${diaMes} de ${mes} de ${anio}`;
}

/**
 * Retorna la fecha de hoy en formato ISO (YYYY-MM-DD) para inicializar inputs de tipo date y [max].
 */
export function obtenerFechaHoyISO(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Validador para Reactive Forms que impide fechas futuras.
 * Retorna { fechaFutura: true } si la fecha ingresada es posterior al día en curso.
 */
export function fechaNoFuturaValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const fechaIngresada = new Date(`${control.value}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (fechaIngresada > hoy) {
    return { fechaFutura: true };
  }
  return null;
}
