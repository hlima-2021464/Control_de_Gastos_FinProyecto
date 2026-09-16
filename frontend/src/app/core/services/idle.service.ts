import { Injectable, NgZone, inject, OnDestroy, effect } from '@angular/core';
import { fromEvent, merge, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

/** Tiempo límite de inactividad total: 15 minutos (en milisegundos) por defecto */
export const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Intervalo para renovar el token en el backend durante interacción continua: 60 segundos */
export const REFRESH_THROTTLE_MS = 60 * 1000;

@Injectable({ providedIn: 'root' })
export class IdleService implements OnDestroy {
  private readonly ngZone          = inject(NgZone);
  private readonly authService     = inject(AuthService);
  private readonly settingsService = inject(SettingsService);

  private idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private activitySubscription: Subscription | null = null;
  private refreshSubscription: Subscription | null = null;
  private settingsSubscription: Subscription | null = null;
  private isRunning = false;

  private readonly events: (keyof WindowEventMap)[] = [
    'mousemove',
    'keydown',
    'click',
    'scroll',
    'touchstart',
  ];

  constructor() {
    // Sincronización reactiva del temporizador según la configuración del usuario
    this.settingsSubscription = this.settingsService.tiempoInactividadMin$.subscribe((min) => {
      this.idleTimeoutMs = (Number(min) || 15) * 60 * 1000;
      if (this.isRunning) {
        this.resetTimer();
      }
    });

    // Escucha reactiva: activa o desactiva la vigilancia según el estado de la sesión
    effect(() => {
      const user = this.authService.currentUser();
      const expired = this.authService.sessionExpired();

      if (user && !expired) {
        const timeout = (this.settingsService.snapshot.tiempoInactividadMin || 15) * 60 * 1000;
        this.start(timeout);
      } else {
        this.stop();
      }
    });
  }

  /** Retorna los minutos configurados actuales */
  get timeoutMinutes(): number {
    return Math.round(this.idleTimeoutMs / (60 * 1000));
  }

  /** Permite ajustar los minutos directamente delegando en SettingsService */
  setIdleTimeoutMinutes(minutes: number): void {
    this.settingsService.actualizarTiempoInactividad(minutes);
  }


  /**
   * Configura e inicia la vigilancia de inactividad del usuario.
   * @param timeoutMs Duración en ms antes de considerar inactivo (15 minutos por defecto)
   */
  start(timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS): void {
    this.idleTimeoutMs = timeoutMs;
    this.stop(); // Limpia listeners o timers previos

    this.isRunning = true;
    this.resetTimer();

    // Registrar observadores de eventos fuera de NgZone para alto rendimiento
    this.ngZone.runOutsideAngular(() => {
      const eventStreams = this.events.map((eventName) =>
        fromEvent(window, eventName, { passive: true })
      );

      const combinedActivity$ = merge(...eventStreams);

      // 1. Reiniciar continuamente el temporizador de inactividad local con throttle de 15s
      this.activitySubscription = combinedActivity$
        .pipe(
          throttleTime(15_000, undefined, { leading: true, trailing: true })
        )
        .subscribe(() => {
          if (this.isRunning) {
            this.resetTimer();
          }
        });

      // 2. Renovar el token en el backend con limitador de 60s mientras exista interacción
      this.refreshSubscription = combinedActivity$
        .pipe(
          throttleTime(REFRESH_THROTTLE_MS, undefined, { leading: true, trailing: true })
        )
        .subscribe(() => {
          if (this.isRunning) {
            this.authService.refreshTokenOnActivity();
          }
        });
    });
  }

  /**
   * Detiene los listeners y temporizadores de inactividad.
   */
  stop(): void {
    this.isRunning = false;
    this.clearTimer();
    if (this.activitySubscription) {
      this.activitySubscription.unsubscribe();
      this.activitySubscription = null;
    }
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }
  }

  /**
   * Reinicia el temporizador de inactividad al período completo configurado.
   */
  private resetTimer(): void {
    this.clearTimer();

    this.idleTimer = setTimeout(() => {
      this.handleTimeout();
    }, this.idleTimeoutMs);
  }

  /**
   * Limpia el temporizador activo.
   */
  private clearTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Se ejecuta únicamente al agotarse el período de inactividad total.
   */
  private handleTimeout(): void {
    this.stop();
    this.ngZone.run(() => {
      this.authService.triggerSessionExpired();
    });
  }

  ngOnDestroy(): void {
    this.stop();
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
      this.settingsSubscription = null;
    }
  }
}

