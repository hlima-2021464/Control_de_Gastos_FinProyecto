import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface MonedaConfig {
  codigo: 'GTQ' | 'USD' | 'EUR';
  simbolo: 'Q' | '$' | '€';
  nombre: 'Quetzales' | 'Dólares estadounidenses' | 'Euros';
}

export type FormatoFecha = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'TEXTUAL';

export interface NotificacionesConfig {
  visualesActivas: boolean;
  alertaPresupuesto80: boolean;
  alertaDesborde100: boolean;
  recordatorioPeriodico: boolean;
}

export interface VisualProfileConfig {
  nombreVisualizacion: string;
  tipoAvatar: 'oficial' | 'iniciales';
  fondoGradiente: string;
}

export interface AppSettings {
  moneda: MonedaConfig;
  diaInicioCiclo: number;
  formatoFecha: FormatoFecha;
  tiempoInactividadMin: number;
  perfilVisual: VisualProfileConfig;
  notificaciones: NotificacionesConfig;
}

export const MONEDAS_DISPONIBLES: Record<'GTQ' | 'USD' | 'EUR', MonedaConfig> = {
  GTQ: { codigo: 'GTQ', simbolo: 'Q', nombre: 'Quetzales' },
  USD: { codigo: 'USD', simbolo: '$', nombre: 'Dólares estadounidenses' },
  EUR: { codigo: 'EUR', simbolo: '€', nombre: 'Euros' },
};

export const GRADIENTES_AVATAR = [
  { id: 'violet-cyan', nombre: 'Violeta y Cian', clases: 'from-violet-600 to-cyan-400' },
  { id: 'fuchsia-rose', nombre: 'Fucsia y Rosa', clases: 'from-fuchsia-600 to-rose-400' },
  { id: 'emerald-teal', nombre: 'Esmeralda y Turquesa', clases: 'from-emerald-500 to-teal-400' },
  { id: 'amber-orange', nombre: 'Ámbar y Naranja', clases: 'from-amber-500 to-orange-500' },
  { id: 'blue-indigo', nombre: 'Azul e Índigo', clases: 'from-blue-600 to-indigo-600' },
];

export const SETTINGS_POR_DEFECTO: AppSettings = {
  moneda: MONEDAS_DISPONIBLES['GTQ'],
  diaInicioCiclo: 1,
  formatoFecha: 'DD/MM/YYYY',
  tiempoInactividadMin: 15,
  perfilVisual: {
    nombreVisualizacion: '',
    tipoAvatar: 'oficial',
    fondoGradiente: 'from-violet-600 to-cyan-400',
  },
  notificaciones: {
    visualesActivas: true,
    alertaPresupuesto80: true,
    alertaDesborde100: true,
    recordatorioPeriodico: false,
  },
};

const STORAGE_KEY = 'control_gastos_configuracion';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly settingsSubject = new BehaviorSubject<AppSettings>(this.cargarEstadoInicial());

  /** Flujo reactivo de configuración global */
  readonly settings$: Observable<AppSettings> = this.settingsSubject.asObservable();

  /** Flujo de la divisa configurada */
  readonly moneda$: Observable<MonedaConfig> = this.settings$.pipe(map((s) => s.moneda));

  /** Símbolo de moneda reactivo ('Q', '$', '€') */
  readonly simboloMoneda$: Observable<string> = this.moneda$.pipe(map((m) => m.simbolo));

  /** Día de inicio del ciclo financiero */
  readonly diaInicioCiclo$: Observable<number> = this.settings$.pipe(map((s) => s.diaInicioCiclo));

  /** Formato de fecha preferido */
  readonly formatoFecha$: Observable<FormatoFecha> = this.settings$.pipe(map((s) => s.formatoFecha));

  /** Minutos de inactividad configurados */
  readonly tiempoInactividadMin$: Observable<number> = this.settings$.pipe(map((s) => s.tiempoInactividadMin));

  /** Configuración visual del perfil */
  readonly perfilVisual$: Observable<VisualProfileConfig> = this.settings$.pipe(map((s) => s.perfilVisual));

  /** Configuración de reglas de notificación */
  readonly notificaciones$: Observable<NotificacionesConfig> = this.settings$.pipe(map((s) => s.notificaciones));

  constructor() {
    // Sincronización automática ante cambios en otras pestañas del navegador
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
          this.settingsSubject.next(this.cargarEstadoInicial());
        }
      });
    }
  }

  /** Obtiene una captura sincrónica del estado actual */
  get snapshot(): AppSettings {
    return this.settingsSubject.getValue();
  }

  /** Actualiza la divisa principal del sistema */
  actualizarMoneda(codigo: 'GTQ' | 'USD' | 'EUR'): void {
    const moneda = MONEDAS_DISPONIBLES[codigo] || MONEDAS_DISPONIBLES['GTQ'];
    this.actualizarParcial({ moneda });
  }

  /** Actualiza el día de corte del ciclo financiero */
  actualizarDiaInicioCiclo(dia: number): void {
    const diaValido = Math.min(Math.max(Number(dia) || 1, 1), 31);
    this.actualizarParcial({ diaInicioCiclo: diaValido });
  }

  /** Actualiza el formato de fecha visual */
  actualizarFormatoFecha(formato: FormatoFecha): void {
    this.actualizarParcial({ formatoFecha: formato });
  }

  /** Actualiza el temporizador de inactividad en minutos */
  actualizarTiempoInactividad(minutos: number): void {
    const minValido = Math.min(Math.max(Number(minutos) || 15, 1), 60);
    this.actualizarParcial({ tiempoInactividadMin: minValido });
  }

  /** Actualiza las opciones estéticas del perfil */
  actualizarPerfilVisual(cambios: Partial<VisualProfileConfig>): void {
    const actual = this.settingsSubject.getValue().perfilVisual;
    this.actualizarParcial({
      perfilVisual: { ...actual, ...cambios },
    });
  }

  /** Actualiza las reglas de notificaciones */
  actualizarReglasNotificaciones(cambios: Partial<NotificacionesConfig>): void {
    const actual = this.settingsSubject.getValue().notificaciones;
    this.actualizarParcial({
      notificaciones: { ...actual, ...cambios },
    });
  }

  /** Actualiza la configuración completa (p. ej. al importar un respaldo) */
  actualizarConfiguracionCompleta(nuevaConfig: Partial<AppSettings>): void {
    const actual = this.settingsSubject.getValue();
    const fusionada: AppSettings = {
      ...actual,
      ...nuevaConfig,
      moneda: nuevaConfig.moneda || actual.moneda,
      perfilVisual: { ...actual.perfilVisual, ...(nuevaConfig.perfilVisual || {}) },
      notificaciones: { ...actual.notificaciones, ...(nuevaConfig.notificaciones || {}) },
    };
    this.settingsSubject.next(fusionada);
    this.persistirEstado(fusionada);
  }

  /** Restablece la configuración predeterminada de fábrica */
  restablecerAjustesPredeterminados(): void {
    this.settingsSubject.next({ ...SETTINGS_POR_DEFECTO });
    this.persistirEstado(SETTINGS_POR_DEFECTO);
  }

  private actualizarParcial(cambios: Partial<AppSettings>): void {
    const actual = this.settingsSubject.getValue();
    const actualizado: AppSettings = { ...actual, ...cambios };
    this.settingsSubject.next(actualizado);
    this.persistirEstado(actualizado);
  }

  private cargarEstadoInicial(): AppSettings {
    if (typeof localStorage === 'undefined') {
      return { ...SETTINGS_POR_DEFECTO };
    }

    try {
      const serializado = localStorage.getItem(STORAGE_KEY);
      if (!serializado) {
        return { ...SETTINGS_POR_DEFECTO };
      }
      const parsed = JSON.parse(serializado);
      return {
        ...SETTINGS_POR_DEFECTO,
        ...parsed,
        moneda: parsed.moneda || SETTINGS_POR_DEFECTO.moneda,
        perfilVisual: { ...SETTINGS_POR_DEFECTO.perfilVisual, ...(parsed.perfilVisual || {}) },
        notificaciones: { ...SETTINGS_POR_DEFECTO.notificaciones, ...(parsed.notificaciones || {}) },
      };
    } catch {
      return { ...SETTINGS_POR_DEFECTO };
    }
  }

  private persistirEstado(ajustes: AppSettings): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ajustes));
    } catch (e) {
      console.warn('[SettingsService] Error al guardar configuración en localStorage', e);
    }
  }
}
