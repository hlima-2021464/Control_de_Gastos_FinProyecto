import { Component, inject, signal, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { IncomeService, IncomeItem } from '../../core/services/income.service';
import { ExpenseService, ExpenseItem, GastoPorCategoria } from '../../core/services/expense.service';
import { BudgetService, BudgetProgress } from '../../core/services/budget.service';
import { SavingsService } from '../../core/services/savings.service';
import { obtenerMesAnioActual } from '../../core/utils/date.utils';

export interface AppNotification {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  hora: string;
}

export interface ColumnaGrafica {
  etiqueta: string;
  rango: string;
  monto: number;
  porcentajeAltura: number;
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
  private readonly elementRef = inject(ElementRef);

  readonly currentUser = this.authSvc.currentUser;

  // ─── Fechas en tiempo real dinámicas ─────────────────────────
  readonly mesAnioActual = signal<string>(obtenerMesAnioActual());

  // ─── Filtro de Período Operativo (Semana / Mes / Año) ────────
  readonly activePeriod = signal<'Semana' | 'Mes' | 'Año'>('Mes');
  private readonly periodSubject = new BehaviorSubject<'Semana' | 'Mes' | 'Año'>('Mes');

  // ─── Notificaciones Interactivas Flotantes ───────────────────
  readonly mostrarDropdownNotif = signal<boolean>(false);
  readonly notificaciones = signal<AppNotification[]>([
    {
      id: 'notif-1',
      titulo: 'Plataforma Totalmente Sincronizada',
      mensaje: 'El Balance, Gastos Acumulados y Fondo de Reserva se recalculan automáticamente.',
      leida: false,
      hora: 'Hace 5 min',
    },
    {
      id: 'notif-2',
      titulo: 'Autenticación con Google Activa',
      mensaje: 'Sesión iniciada con identidad de Google OAuth 2.0 y perfil sincronizado.',
      leida: false,
      hora: 'Hace 20 min',
    },
    {
      id: 'notif-3',
      titulo: 'Control de Sesión por Actividad',
      mensaje: 'El token de autenticación se mantiene activo mientras interactúa con el sistema.',
      leida: false,
      hora: 'Hace 1 hora',
    },
    {
      id: 'notif-4',
      titulo: 'Resumen Financiero Consolidado',
      mensaje: 'El balance y desglose financiero del período se encuentran actualizados.',
      leida: false,
      hora: 'Hoy',
    },
  ]);

  readonly contadorNoLeidas = computed(() =>
    this.notificaciones().filter((n) => !n.leida).length
  );

  // ─── Filtrado de Transacciones por Período ───────────────────
  private readonly datosFiltrados$ = combineLatest([
    this.incomeSvc.ingresos$,
    this.expenseSvc.gastos$,
    this.periodSubject.asObservable(),
  ]).pipe(
    map(([ingresos, gastos, periodo]) => {
      const hoy = new Date();
      const anioActual = hoy.getFullYear();
      const mesActual = hoy.getMonth(); // 0 a 11

      const filtrarFecha = (fechaStr: string): boolean => {
        if (!fechaStr) return false;
        const [anioStr, mesStr, diaStr] = fechaStr.split('-');
        const itemAnio = parseInt(anioStr, 10);
        const itemMes = parseInt(mesStr, 10) - 1;
        const itemDia = parseInt(diaStr, 10);
        const fechaItem = new Date(itemAnio, itemMes, itemDia);

        if (periodo === 'Semana') {
          // Últimos 7 días corridos
          const hace7Dias = new Date();
          hace7Dias.setDate(hoy.getDate() - 7);
          hace7Dias.setHours(0, 0, 0, 0);
          return fechaItem >= hace7Dias && fechaItem <= hoy;
        }

        if (periodo === 'Mes') {
          return itemAnio === anioActual && itemMes === mesActual;
        }

        // Periodo Año
        return itemAnio === anioActual;
      };

      const ingresosFiltrados = ingresos.filter((i) => filtrarFecha(i.fecha));
      const gastosFiltrados = gastos.filter((g) => filtrarFecha(g.fecha));

      return { ingresosFiltrados, gastosFiltrados, periodo };
    })
  );

  /** Ingresos filtrados por el período seleccionado */
  readonly totalIngresos$: Observable<number> = this.datosFiltrados$.pipe(
    map(({ ingresosFiltrados }) =>
      ingresosFiltrados.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    )
  );

  /** Gastos filtrados por el período seleccionado */
  readonly totalGastos$: Observable<number> = this.datosFiltrados$.pipe(
    map(({ gastosFiltrados }) =>
      gastosFiltrados.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    )
  );

  /** Balance Total reactivo (Ingresos - Gastos del período) */
  readonly balanceTotal$: Observable<number> = combineLatest([
    this.totalIngresos$,
    this.totalGastos$,
  ]).pipe(map(([ingresos, gastos]) => ingresos - gastos));

  /** Fondo de ahorro total acumulado */
  readonly totalAhorrado$: Observable<number> = this.savingsSvc.totalAhorrado$;

  /** Histograma dinámico con columnas adaptadas según el período */
  readonly columnasSemanales$: Observable<ColumnaGrafica[]> = this.datosFiltrados$.pipe(
    map(({ ingresosFiltrados, periodo }) => {
      const hoy = new Date();

      if (periodo === 'Semana') {
        // 7 Días de la semana
        const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dias: { etiqueta: string; rango: string; fechaKey: string; monto: number }[] = [];

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(hoy.getDate() - i);
          const diaNum = d.getDate();
          const mesNum = d.getMonth() + 1;
          const diaNom = diasNombres[d.getDay()];
          const iso = d.toISOString().split('T')[0];
          dias.push({
            etiqueta: diaNom,
            rango: `${diaNum}/${mesNum}`,
            fechaKey: iso,
            monto: 0,
          });
        }

        ingresosFiltrados.forEach((item) => {
          const coincidente = dias.find((d) => d.fechaKey === item.fecha);
          if (coincidente) {
            coincidente.monto += Number(item.monto) || 0;
          }
        });

        const maxMonto = Math.max(...dias.map((d) => d.monto), 0);

        return dias.map((d) => ({
          etiqueta: d.etiqueta,
          rango: d.rango,
          monto: d.monto,
          porcentajeAltura: maxMonto > 0 && d.monto > 0 ? Math.max(14, Math.round((d.monto / maxMonto) * 100)) : 0,
        }));
      }

      if (periodo === 'Año') {
        // 12 Meses del año en curso
        const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const anio = hoy.getFullYear();
        const meses = nombresMeses.map((nombre, index) => ({
          etiqueta: nombre,
          rango: `${nombre} ${anio}`,
          mesIndex: index,
          monto: 0,
        }));

        ingresosFiltrados.forEach((item) => {
          const mesItem = item.fecha ? parseInt(item.fecha.split('-')[1] || '1', 10) - 1 : 0;
          if (meses[mesItem]) {
            meses[mesItem].monto += Number(item.monto) || 0;
          }
        });

        const maxMonto = Math.max(...meses.map((m) => m.monto), 0);

        return meses.map((m) => ({
          etiqueta: m.etiqueta,
          rango: m.rango,
          monto: m.monto,
          porcentajeAltura: maxMonto > 0 && m.monto > 0 ? Math.max(14, Math.round((m.monto / maxMonto) * 100)) : 0,
        }));
      }

      // Periodo 'Mes' por defecto: 5 semanas del mes
      const semanas = [
        { rango: '1 - 7', etiqueta: 'Semana 1', start: 1, end: 7, monto: 0 },
        { rango: '8 - 14', etiqueta: 'Semana 2', start: 8, end: 14, monto: 0 },
        { rango: '15 - 21', etiqueta: 'Semana 3', start: 15, end: 21, monto: 0 },
        { rango: '22 - 28', etiqueta: 'Semana 4', start: 22, end: 28, monto: 0 },
        { rango: '29 - 31', etiqueta: 'Semana 5', start: 29, end: 31, monto: 0 },
      ];

      ingresosFiltrados.forEach((item) => {
        const dia = item.fecha ? parseInt(item.fecha.split('-')[2] || '1', 10) : 1;
        const sem = semanas.find((s) => dia >= s.start && dia <= s.end) || semanas[0];
        sem.monto += Number(item.monto) || 0;
      });

      const maxMonto = Math.max(...semanas.map((s) => s.monto), 0);

      return semanas.map((s) => ({
        etiqueta: s.etiqueta,
        rango: s.rango,
        monto: s.monto,
        porcentajeAltura: maxMonto > 0 && s.monto > 0 ? Math.max(14, Math.round((s.monto / maxMonto) * 100)) : 0,
      }));
    })
  );

  /** Desglose de gastos por categoría calculado en base al período activo */
  readonly gastosPorCategoria$: Observable<GastoPorCategoria[]> = this.datosFiltrados$.pipe(
    map(({ gastosFiltrados }) => {
      const mapa = new Map<string, number>();
      let total = 0;

      gastosFiltrados.forEach((g) => {
        const monto = Number(g.monto) || 0;
        total += monto;
        const anterior = mapa.get(g.categoria) || 0;
        mapa.set(g.categoria, anterior + monto);
      });

      const resultado: GastoPorCategoria[] = [];
      mapa.forEach((montoCat, categoria) => {
        resultado.push({
          categoria,
          total: montoCat,
          porcentaje: total > 0 ? Math.round((montoCat / total) * 100) : 0,
        });
      });

      return resultado.sort((a, b) => b.total - a.total);
    })
  );

  /** Gastos recientes del período activo */
  readonly gastosRecientes$: Observable<ExpenseItem[]> = this.datosFiltrados$.pipe(
    map(({ gastosFiltrados }) =>
      [...gastosFiltrados]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 5)
    )
  );

  /** Presupuestos por categoría sincronizados */
  readonly presupuestos$: Observable<BudgetProgress[]> = this.budgetSvc.presupuestosConProgreso$;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.mostrarDropdownNotif.set(false);
    }
  }

  setPeriod(period: 'Semana' | 'Mes' | 'Año'): void {
    this.activePeriod.set(period);
    this.periodSubject.next(period);
  }

  toggleDropdownNotif(event: MouseEvent): void {
    event.stopPropagation();
    this.mostrarDropdownNotif.update((v) => !v);
  }

  marcarComoLeida(id: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.notificaciones.update((list) =>
      list.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
  }

  limpiarTodasNotificaciones(event?: MouseEvent): void {
    event?.stopPropagation();
    this.notificaciones.set([]);
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
