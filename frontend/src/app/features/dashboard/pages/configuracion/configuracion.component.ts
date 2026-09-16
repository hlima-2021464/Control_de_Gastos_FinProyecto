import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/services/auth.service';
import {
  SettingsService,
  AppSettings,
  MONEDAS_DISPONIBLES,
} from '../../../../core/services/settings.service';
import { IncomeService } from '../../../../core/services/income.service';
import { ExpenseService } from '../../../../core/services/expense.service';
import { BudgetService } from '../../../../core/services/budget.service';
import { CategoryService } from '../../../../core/services/category.service';
import { SavingsService } from '../../../../core/services/savings.service';
import { IdleService } from '../../../../core/services/idle.service';

export interface ToastNotificacion {
  visible: boolean;
  tipo: 'exito' | 'error' | 'info';
  titulo: string;
  mensaje: string;
}

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.css'],
})
export class ConfiguracionComponent {
  private readonly authSvc = inject(AuthService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly incomeSvc = inject(IncomeService);
  private readonly expenseSvc = inject(ExpenseService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly categorySvc = inject(CategoryService);
  private readonly savingsSvc = inject(SavingsService);
  private readonly idleSvc = inject(IdleService);
  private readonly router = inject(Router);

  // ─── Estado Reactivo ──────────────────────────────────────────
  readonly currentUser = this.authSvc.currentUser;
  readonly settings = toSignal(this.settingsSvc.settings$, { initialValue: this.settingsSvc.snapshot });

  // ─── Constantes del Sistema ───────────────────────────────────
  readonly monedasDisponibles = Object.values(MONEDAS_DISPONIBLES);
  readonly opcionesInactividad = [5, 10, 15, 30];
  readonly diasCorte = Array.from({ length: 28 }, (_, i) => i + 1);

  // ─── Modales ──────────────────────────────────────────────────
  readonly mostrarModalLogout = signal<boolean>(false);
  readonly mostrarModalPurga = signal<boolean>(false);
  readonly palabraConfirmacion = signal<string>('');

  // ─── Edición de Nombre de Visualización ───────────────────────
  readonly nombreVisualizacionInput = signal<string>(
    this.settingsSvc.snapshot.perfilVisual.nombreVisualizacion || ''
  );

  // ─── Sistema de Alertas Flotantes (Toasts) ───────────────────
  readonly toast = signal<ToastNotificacion | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Getters de Perfil e Identidad ───────────────────────────
  get userRealName(): string {
    const user = this.currentUser();
    return user?.name || user?.username || 'Usuario';
  }

  get userDisplayName(): string {
    const custom = this.settings()?.perfilVisual?.nombreVisualizacion?.trim();
    return custom && custom.length > 0 ? custom : this.userRealName;
  }

  get userEmail(): string {
    const user = this.currentUser();
    return user?.email || 'No especificado';
  }

  get userRole(): string {
    const user = this.currentUser();
    return user?.role === 'ADMIN' ? 'Administrador del Sistema' : 'Usuario Personal';
  }

  get userAvatarUrl(): string | null {
    const user = this.currentUser();
    return user?.picture || user?.avatarUrl || null;
  }

  get tiempoInactividadActual(): number {
    return this.settings()?.tiempoInactividadMin || 15;
  }

  get diaInicioCicloActual(): number {
    return this.settings()?.diaInicioCiclo || 1;
  }

  get monedaActualCodigo(): 'GTQ' | 'USD' | 'EUR' {
    return this.settings()?.moneda?.codigo || 'GTQ';
  }

  get palabraConfirmacionValida(): boolean {
    return this.palabraConfirmacion().trim() === 'CONFIRMAR';
  }

  // ─── Gestión de Perfil de Acceso ──────────────────────────────
  guardarNombreVisualizacion(): void {
    const nuevoNombre = this.nombreVisualizacionInput().trim();
    this.settingsSvc.actualizarPerfilVisual({ nombreVisualizacion: nuevoNombre });
    this.mostrarToast(
      'Nombre de Visualización Actualizado',
      nuevoNombre
        ? `El saludo del sistema ahora mostrará "${nuevoNombre}".`
        : 'Se ha restablecido el nombre predeterminado de la cuenta.'
    );
  }

  abrirModalLogout(): void {
    this.mostrarModalLogout.set(true);
  }

  cerrarModalLogout(): void {
    this.mostrarModalLogout.set(false);
  }

  confirmarCierreSesionForzado(): void {
    this.mostrarModalLogout.set(false);
    this.authSvc.logout();
    this.router.navigate(['/login']);
  }

  // ─── Preferencias Regionales y Moneda ────────────────────────
  cambiarMoneda(codigo: 'GTQ' | 'USD' | 'EUR'): void {
    this.settingsSvc.actualizarMoneda(codigo);
    const m = MONEDAS_DISPONIBLES[codigo];
    this.mostrarToast(
      'Divisa Principal Modificada',
      `Todas las métricas y transacciones ahora se recalculan en ${m.nombre} (${m.simbolo}).`
    );
  }

  cambiarDiaInicioCiclo(dia: number): void {
    const diaNum = Number(dia) || 1;
    this.settingsSvc.actualizarDiaInicioCiclo(diaNum);
    this.mostrarToast(
      'Ciclo Financiero Actualizado',
      `El corte mensual se calculará a partir del día ${diaNum} de cada mes.`
    );
  }

  cambiarTiempoInactividad(min: number): void {
    const minNum = Number(min) || 15;
    this.settingsSvc.actualizarTiempoInactividad(minNum);
    this.idleSvc.setIdleTimeoutMinutes(minNum);
    this.mostrarToast(
      'Temporizador de Inactividad Actualizado',
      `La sesión se vigilará automáticamente por ${minNum} minutos de inactividad continua.`
    );
  }

  // ─── Copia de Seguridad y Gestión de Datos ────────────────────
  exportarRespaldoJSON(): void {
    const snapshotConfig = this.settingsSvc.snapshot;
    const respaldo = {
      version: '2.0.0',
      fechaExportacion: new Date().toISOString(),
      metadatos: {
        sistema: 'Control de Gastos Web Platform',
        ambiente: 'Producción Local',
      },
      usuario: {
        nombreReal: this.userRealName,
        nombreVisualizacion: this.userDisplayName,
        email: this.userEmail,
        rol: this.userRole,
      },
      configuracion: snapshotConfig,
      datos: {
        ingresos: this.incomeSvc.snapshot,
        gastos: this.expenseSvc.snapshot,
        presupuestos: this.budgetSvc.snapshot,
        categorias: this.categorySvc.snapshot,
        ahorros: this.savingsSvc.snapshot,
      },
    };

    const jsonStr = JSON.stringify(respaldo, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_control_gastos_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.mostrarToast(
      'Respaldo Exportado Exitosamente',
      'El archivo JSON con la totalidad de sus datos financieros y configuración ha sido descargado.'
    );
  }

  importarRespaldoJSON(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const archivo = input.files[0];
    const lector = new FileReader();

    lector.onload = () => {
      try {
        const contenido = lector.result as string;
        const parseado = JSON.parse(contenido);

        if (!parseado.datos || typeof parseado.datos !== 'object') {
          throw new Error('El archivo no contiene el bloque principal de transacciones ("datos").');
        }

        const { ingresos, gastos, presupuestos, categorias, ahorros } = parseado.datos;

        if (ingresos && Array.isArray(ingresos)) {
          this.incomeSvc.restaurarIngresos(ingresos);
        }
        if (gastos && Array.isArray(gastos)) {
          this.expenseSvc.restaurarGastos(gastos);
        }
        if (presupuestos && Array.isArray(presupuestos)) {
          this.budgetSvc.restaurarPresupuestos(presupuestos);
        }
        if (categorias && Array.isArray(categorias)) {
          this.categorySvc.restaurarCategorias(categorias);
        }
        if (ahorros && Array.isArray(ahorros)) {
          this.savingsSvc.restaurarMetas(ahorros);
        }

        if (parseado.configuracion && typeof parseado.configuracion === 'object') {
          this.settingsSvc.actualizarConfiguracionCompleta(parseado.configuracion);
          if (parseado.configuracion.perfilVisual?.nombreVisualizacion) {
            this.nombreVisualizacionInput.set(parseado.configuracion.perfilVisual.nombreVisualizacion);
          }
        }

        this.mostrarToast(
          'Restauración Exitosa',
          'Los datos financieros y preferencias han sido sincronizados en su totalidad.'
        );
      } catch (err: any) {
        this.mostrarToast(
          'Error de Importación',
          err?.message || 'El archivo seleccionado no posee un formato JSON válido de Control de Gastos.',
          'error'
        );
      } finally {
        input.value = '';
      }
    };

    lector.readAsText(archivo);
  }

  abrirModalPurga(): void {
    this.palabraConfirmacion.set('');
    this.mostrarModalPurga.set(true);
  }

  cerrarModalPurga(): void {
    this.mostrarModalPurga.set(false);
    this.palabraConfirmacion.set('');
  }

  ejecutarPurgaConfirmada(): void {
    if (!this.palabraConfirmacionValida) return;

    this.incomeSvc.limpiarIngresos();
    this.expenseSvc.limpiarGastos();
    this.budgetSvc.resetearLimites();
    this.categorySvc.restablecerCategorias();
    this.savingsSvc.limpiarMetas();
    this.settingsSvc.restablecerAjustesPredeterminados();
    this.nombreVisualizacionInput.set('');

    this.mostrarToast(
      'Restablecimiento Total Completado',
      'La plataforma ha vuelto a su estado de fábrica en cero.'
    );

    this.cerrarModalPurga();
  }

  // ─── Utilidad de Toast Flotante ───────────────────────────────
  private mostrarToast(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'info' = 'exito'): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toast.set({ visible: true, tipo, titulo, mensaje });
    this.toastTimer = setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 4000);
  }
}
