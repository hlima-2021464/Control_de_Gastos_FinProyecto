import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { IncomeService, ColumnaSemanal } from '../../core/services/income.service';
import { ExpenseService, ExpenseItem, GastoPorCategoria } from '../../core/services/expense.service';
import { BudgetService, BudgetProgress } from '../../core/services/budget.service';
import { SavingsService } from '../../core/services/savings.service';

export interface AppNotification {
  id: string;
  titulo: string;
  mensaje: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  private readonly authSvc = inject(AuthService);
  private readonly incomeSvc = inject(IncomeService);
  private readonly expenseSvc = inject(ExpenseService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly savingsSvc = inject(SavingsService);
  private readonly router = inject(Router);

  readonly currentUser = this.authSvc.currentUser;

  // Filtro de periodo para la gráfica de Gastos vs Ingresos
  readonly activePeriod = signal<'Semana' | 'Mes' | 'Año'>('Mes');

  // ─── Métricas reactivas sincronizadas en tiempo real ────────
  readonly totalIngresos$: Observable<number> = this.incomeSvc.totalIngresos$;
  readonly totalGastos$: Observable<number> = this.expenseSvc.totalGastos$;

  /** Balance Total = Total Ingresos - Total Gastos */
  readonly balanceTotal$: Observable<number> = combineLatest([
    this.totalIngresos$,
    this.totalGastos$,
  ]).pipe(map(([ingresos, gastos]) => ingresos - gastos));

  /** Fondo de ahorro total acumulado */
  readonly totalAhorrado$: Observable<number> = this.savingsSvc.totalAhorrado$;

  /** Histograma de captación semanal recalculado */
  readonly columnasSemanales$: Observable<ColumnaSemanal[]> = this.incomeSvc.columnasSemanales$;

  /** Desglose consolidado de gastos por categoría */
  readonly gastosPorCategoria$: Observable<GastoPorCategoria[]> = this.expenseSvc.gastosPorCategoria$;

  /** Últimas 5 transacciones de gasto */
  readonly gastosRecientes$: Observable<ExpenseItem[]> = this.expenseSvc.gastosRecientes$;

  /** Presupuestos por categoría sincronizados */
  readonly presupuestos$: Observable<BudgetProgress[]> = this.budgetSvc.presupuestosConProgreso$;

  // ─── Notificaciones Intercaladas Dinámicas ──────────────────
  readonly notificaciones = signal<AppNotification[]>([
    {
      id: 'notif-1',
      titulo: 'Plataforma Totalmente Sincronizada',
      mensaje: 'El Balance Total, los Gastos Acumulados y el Fondo de Reserva se recalculan automáticamente.',
    },
    {
      id: 'notif-2',
      titulo: 'Autenticación con Google Activa',
      mensaje: 'Sesión iniciada con identidad de Google OAuth 2.0 y perfil sincronizado.',
    },
    {
      id: 'notif-3',
      titulo: 'Control de Sesión por Actividad',
      mensaje: 'El token de autenticación se mantiene activo mientras interactúa con el sistema.',
    },
    {
      id: 'notif-4',
      titulo: 'Resumen Financiero Consolidado',
      mensaje: 'El balance y desglose financiero del período se encuentran actualizados.',
    },
  ]);

  setPeriod(period: 'Semana' | 'Mes' | 'Año'): void {
    this.activePeriod.set(period);
  }

  logout(): void {
    this.authSvc.logout();
    this.router.navigate(['/login']);
  }

  get userDisplayName(): string {
    const user = this.currentUser();
    return user?.name || user?.username || user?.email || 'Usuario';
  }

  get userAvatarUrl(): string | null {
    const user = this.currentUser();
    return user?.picture || user?.avatarUrl || null;
  }

  get userInitial(): string {
    const name = this.userDisplayName;
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : 'U';
  }
}
