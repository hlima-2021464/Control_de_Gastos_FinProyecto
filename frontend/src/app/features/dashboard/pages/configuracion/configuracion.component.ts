import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/services/auth.service';
import {
  SettingsService,
  AppSettings,
  MonedaConfig,
  FormatoFecha,
  MONEDAS_DISPONIBLES,
  GRADIENTES_AVATAR,
  NotificacionesConfig,
} from '../../../../core/services/settings.service';
import { IncomeService, IncomeItem } from '../../../../core/services/income.service';
import { ExpenseService, ExpenseItem } from '../../../../core/services/expense.service';
import { BudgetService, BudgetItem } from '../../../../core/services/budget.service';
import { CategoryService, CategoryItem } from '../../../../core/services/category.service';
import { SavingsService, SavingGoal } from '../../../../core/services/savings.service';
import { IdleService } from '../../../../core/services/idle.service';

export type TabConfiguracion = 'perfil' | 'regional' | 'seguridad' | 'notificaciones' | 'datos';

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

  // ─── Pestaña Activa ───────────────────────────────────────────
  readonly activeTab = signal<TabConfiguracion>('perfil');

  // ─── Estado Reactivo ──────────────────────────────────────────
  readonly currentUser = this.authSvc.currentUser;
  readonly settings = toSignal(this.settingsSvc.settings$, { initialValue: this.settingsSvc.snapshot });

  // ─── Constantes del Sistema ───────────────────────────────────
  readonly monedasDisponibles = Object.values(MONEDAS_DISPONIBLES);
  readonly gradientesDisponibles = GRADIENTES_AVATAR;
  readonly opcionesInactividad = [5, 10, 15, 30];
  readonly opcionesCiclo = [1, 5, 10, 15, 20, 25, 28];

  // ─── Modales ──────────────────────────────────────────────────
  readonly mostrarModalLogout = signal<boolean>(false);
  readonly mostrarModalPurga = signal<boolean>(false);
  readonly tipoPurgaSeleccionada = signal<'total' | 'ingresos' | 'gastos' | 'ahorro'>('total');
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
    const perfil = this.settings()?.perfilVisual;
    if (perfil?.tipoAvatar === 'iniciales') {
      return null;
    }
    const user = this.currentUser();
    return user?.picture || user?.avatarUrl || null;
  }

  get avatarGradientClass(): string {
    return this.settings()?.perfilVisual?.fondoGradiente || 'from-violet-600 to-cyan-400';
  }

  get userInitial(): string {
    const name = this.userDisplayName;
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : 'U';
  }

  get tipoAutenticacion(): string {
    return this.authSvc.tipoAutenticacion;
  }

  get ultimoTokenRenovado(): string {
    return this.authSvc.ultimoTokenRenovado();
  }

  get tiempoInactividadActual(): number {
    return this.settings()?.tiempoInactividadMin || 15;
  }

  get palabraConfirmacionValida(): boolean {
    return this.palabraConfirmacion().trim() === 'CONFIRMAR';
  }

  // ─── Navegación entre Pestañas ────────────────────────────────
  seleccionarTab(tab: TabConfiguracion): void {
    this.activeTab.set(tab);
  }

  // ─── 1. Gestión de Perfil Visual ──────────────────────────────
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

  seleccionarTipoAvatar(tipo: 'oficial' | 'iniciales'): void {
    this.settingsSvc.actualizarPerfilVisual({ tipoAvatar: tipo });
    this.mostrarToast(
      'Avatar Actualizado',
      tipo === 'oficial'
        ? 'Se muestra el avatar oficial de su cuenta.'
        : 'Se ha activado el avatar con iniciales y estilo personalizado.'
    );
  }

  seleccionarGradiente(clases: string): void {
    this.settingsSvc.actualizarPerfilVisual({
      tipoAvatar: 'iniciales',
      fondoGradiente: clases,
    });
    this.mostrarToast('Paleta de Color Guardada', 'Se actualizó el gradiente de fondo del avatar.');
  }

  // ─── 2. Preferencias Financieras y Regionales ────────────────
  cambiarMoneda(codigo: 'GTQ' | 'USD' | 'EUR'): void {
    this.settingsSvc.actualizarMoneda(codigo);
    const m = MONEDAS_DISPONIBLES[codigo];
    this.mostrarToast(
      'Divisa Principal Modificada',
      `Todas las métricas y tablas ahora se expresan en ${m.nombre} (${m.simbolo}).`
    );
  }

  cambiarDiaInicioCiclo(dia: number): void {
    this.settingsSvc.actualizarDiaInicioCiclo(dia);
    this.mostrarToast(
      'Ciclo Financiero Actualizado',
      `El corte mensual se calculará a partir del día ${dia} de cada mes.`
    );
  }

  cambiarFormatoFecha(formato: FormatoFecha): void {
    this.settingsSvc.actualizarFormatoFecha(formato);
    this.mostrarToast('Formato de Fecha Guardado', `Preferencia de visualización: ${formato}.`);
  }

  // ─── 3. Seguridad y Sesión ────────────────────────────────────
  cambiarTiempoInactividad(min: number): void {
    this.settingsSvc.actualizarTiempoInactividad(min);
    this.idleSvc.setIdleTimeoutMinutes(min);
    this.mostrarToast(
      'Temporizador de Inactividad Actualizado',
      `La sesión se vigilará automáticamente por ${min} minutos de inactividad continua.`
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

  // ─── 4. Reglas de Notificaciones ──────────────────────────────
  toggleNotificacion(campo: keyof NotificacionesConfig): void {
    const actual = this.settings()?.notificaciones[campo] ?? true;
    this.settingsSvc.actualizarReglasNotificaciones({ [campo]: !actual });
    this.mostrarToast(
      'Preferencia de Notificación Modificada',
      !actual ? 'Regla activada correctamente.' : 'Regla desactivada.'
    );
  }

  // ─── 5. Gestión de Datos y Respaldo ───────────────────────────
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
        tipoAutenticacion: this.tipoAutenticacion,
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

        // Validación estricta del esquema de respaldo
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

        // Restaurar configuración si está presente
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

  // ─── Zona de Peligro / Purga Selectiva ─────────────────────────
  abrirModalPurga(tipo: 'total' | 'ingresos' | 'gastos' | 'ahorro'): void {
    this.tipoPurgaSeleccionada.set(tipo);
    this.palabraConfirmacion.set('');
    this.mostrarModalPurga.set(true);
  }

  cerrarModalPurga(): void {
    this.mostrarModalPurga.set(false);
    this.palabraConfirmacion.set('');
  }

  ejecutarPurgaConfirmada(): void {
    if (!this.palabraConfirmacionValida) return;

    const tipo = this.tipoPurgaSeleccionada();

    switch (tipo) {
      case 'ingresos':
        this.incomeSvc.limpiarIngresos();
        this.mostrarToast('Ingresos Eliminados', 'Todos los registros de ingresos fueron borrados.');
        break;
      case 'gastos':
        this.expenseSvc.limpiarGastos();
        this.mostrarToast('Gastos Eliminados', 'Todos los registros de gastos fueron borrados.');
        break;
      case 'ahorro':
        this.savingsSvc.limpiarMetas();
        this.mostrarToast('Metas Eliminadas', 'Todas las alcancías de ahorro fueron borradas.');
        break;
      case 'total':
      default:
        this.incomeSvc.limpiarIngresos();
        this.expenseSvc.limpiarGastos();
        this.budgetSvc.resetearLimites();
        this.categorySvc.restablecerCategorias();
        this.savingsSvc.limpiarMetas();
        this.settingsSvc.restablecerAjustesPredeterminados();
        this.nombreVisualizacionInput.set('');
        this.mostrarToast(
          'Restablecimiento Total Completado',
          'La plataforma ha vuelto a su estado de fábrica en cero ($0.00).'
        );
        break;
    }

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
