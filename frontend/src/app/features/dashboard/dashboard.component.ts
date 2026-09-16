import { Component, inject, signal, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { IncomeService, IncomeItem } from '../../core/services/income.service';
import { ExpenseService, ExpenseItem, GastoPorCategoria } from '../../core/services/expense.service';
import { BudgetService, BudgetProgress } from '../../core/services/budget.service';
import { SavingsService, EventoAhorro } from '../../core/services/savings.service';
import { SettingsService } from '../../core/services/settings.service';
import { obtenerMesAnioActual, obtenerFechaCompletaHoy } from '../../core/utils/date.utils';
import { CurrencyConversionPipe } from '../../core/pipes/currency-conversion.pipe';
import { toSignal } from '@angular/core/rxjs-interop';

export interface AppNotification {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  hora: string;
  tipo?: 'alerta' | 'exito' | 'info';
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
  imports: [CommonModule, FormsModule, RouterLink, CurrencyConversionPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  private readonly authSvc = inject(AuthService);
  private readonly incomeSvc = inject(IncomeService);
  private readonly expenseSvc = inject(ExpenseService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly savingsSvc = inject(SavingsService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  readonly currentUser = this.authSvc.currentUser;
  readonly settings = toSignal(this.settingsSvc.settings$, { initialValue: this.settingsSvc.snapshot });

  /** Símbolo monetario dinámico ('Q', '$', '€') */
  readonly simboloMoneda$: Observable<string> = this.settingsSvc.simboloMoneda$;

  /** Código ISO de moneda ('GTQ', 'USD', 'EUR') */
  readonly codigoMoneda$: Observable<string> = this.settingsSvc.moneda$.pipe(map((m) => m.codigo));

  /** Regla de visibilidad de notificaciones */
  readonly notificacionesActivas$: Observable<boolean> = this.settingsSvc.notificaciones$.pipe(
    map((n) => n.visualesActivas)
  );

  // ─── Fechas en tiempo real dinámicas ─────────────────────────
  readonly mesAnioActual = signal<string>(obtenerMesAnioActual());
  readonly fechaCompletaHoy = signal<string>(obtenerFechaCompletaHoy());
  readonly mostrarSelectorCalendario = signal<boolean>(false);

  // ─── Filtro de Período Operativo (Semana / Mes / Año) ────────
  readonly activePeriod = signal<'Semana' | 'Mes' | 'Año'>('Mes');
  private readonly periodSubject = new BehaviorSubject<'Semana' | 'Mes' | 'Año'>('Mes');

  // ─── Barra de Búsqueda con Lupa ──────────────────────────────
  readonly filtroBusqueda = signal<string>('');
  private readonly busquedaSubject = new BehaviorSubject<string>('');

  // ─── Notificaciones Reactivas en Tiempo Real ──────────────────
  readonly mostrarDropdownNotif = signal<boolean>(false);
  readonly notificaciones = signal<AppNotification[]>([]);
  private readonly notificacionesLimpiadasIds = new Set<string>();

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
      const mesActual = hoy.getMonth();

      const filtrarFecha = (fechaStr: string): boolean => {
        if (!fechaStr) return false;
        const [anioStr, mesStr, diaStr] = fechaStr.split('-');
        const itemAnio = parseInt(anioStr, 10);
        const itemMes = parseInt(mesStr, 10) - 1;
        const itemDia = parseInt(diaStr, 10);
        const fechaItem = new Date(itemAnio, itemMes, itemDia);

        if (periodo === 'Semana') {
          const hace7Dias = new Date();
          hace7Dias.setDate(hoy.getDate() - 7);
          hace7Dias.setHours(0, 0, 0, 0);
          return fechaItem >= hace7Dias && fechaItem <= hoy;
        }

        if (periodo === 'Mes') {
          return itemAnio === anioActual && itemMes === mesActual;
        }

        if (periodo === 'Año') {
          return itemAnio === anioActual;
        }

        return true;
      };

      const ingresosFiltrados = ingresos.filter((item) => filtrarFecha(item.fecha));
      const gastosFiltrados = gastos.filter((item) => filtrarFecha(item.fecha));

      return { ingresosFiltrados, gastosFiltrados, periodo };
    })
  );

  /** Ingresos calculados según el período */
  readonly totalIngresos$: Observable<number> = this.datosFiltrados$.pipe(
    map(({ ingresosFiltrados }) =>
      ingresosFiltrados.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    )
  );

  /** Gastos calculados según el período */
  readonly totalGastos$: Observable<number> = this.datosFiltrados$.pipe(
    map(({ gastosFiltrados }) =>
      gastosFiltrados.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    )
  );

  /** Fondo de ahorro total acumulado */
  readonly totalAhorrado$: Observable<number> = this.savingsSvc.totalAhorrado$;

  /** Balance Total reactivo sincronizado con el Fondo de Ahorro: Ingresos - Gastos - FondosAhorrados */
  readonly balanceTotal$: Observable<number> = combineLatest([
    this.totalIngresos$,
    this.totalGastos$,
    this.totalAhorrado$,
  ]).pipe(
    map(([ingresos, gastos, fondosAhorrados]) =>
      ingresos - gastos - (Number(fondosAhorrados) || 0)
    )
  );

  /** Histograma dinámico con columnas adaptadas según el período */
  readonly columnasSemanales$: Observable<ColumnaGrafica[]> = this.datosFiltrados$.pipe(
    map(({ ingresosFiltrados, periodo }) => {
      const hoy = new Date();

      if (periodo === 'Semana') {
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
          porcentajeAltura: maxMonto > 0 && d.monto > 0 ? Math.max(12, Math.round((d.monto / maxMonto) * 100)) : 0,
        }));
      }

      if (periodo === 'Mes') {
        const semanas = [
          { etiqueta: 'Sem 1', rango: '1 - 7', dias: [1, 7], monto: 0 },
          { etiqueta: 'Sem 2', rango: '8 - 14', dias: [8, 14], monto: 0 },
          { etiqueta: 'Sem 3', rango: '15 - 21', dias: [15, 21], monto: 0 },
          { etiqueta: 'Sem 4', rango: '22 - 28', dias: [22, 28], monto: 0 },
          { etiqueta: 'Sem 5', rango: '29 - 31', dias: [29, 31], monto: 0 },
        ];

        ingresosFiltrados.forEach((item) => {
          if (!item.fecha) return;
          const dia = parseInt(item.fecha.split('-')[2] || '1', 10);
          const sem = semanas.find((s) => dia >= s.dias[0] && dia <= s.dias[1]);
          if (sem) {
            sem.monto += Number(item.monto) || 0;
          }
        });

        const maxMonto = Math.max(...semanas.map((s) => s.monto), 0);

        return semanas.map((s) => ({
          etiqueta: s.etiqueta,
          rango: s.rango,
          monto: s.monto,
          porcentajeAltura: maxMonto > 0 && s.monto > 0 ? Math.max(12, Math.round((s.monto / maxMonto) * 100)) : 0,
        }));
      }

      // Período: Año
      const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const meses = mesesNombres.map((nom, idx) => ({
        etiqueta: nom,
        rango: nom,
        mesIdx: idx,
        monto: 0,
      }));

      ingresosFiltrados.forEach((item) => {
        if (!item.fecha) return;
        const mes = parseInt(item.fecha.split('-')[1] || '1', 10) - 1;
        if (meses[mes]) {
          meses[mes].monto += Number(item.monto) || 0;
        }
      });

      const maxMonto = Math.max(...meses.map((m) => m.monto), 0);

      return meses.map((m) => ({
        etiqueta: m.etiqueta,
        rango: m.rango,
        monto: m.monto,
        porcentajeAltura: maxMonto > 0 && m.monto > 0 ? Math.max(12, Math.round((m.monto / maxMonto) * 100)) : 0,
      }));
    })
  );

  /** Gastos agrupados por categoría reactivos */
  readonly gastosPorCategoria$: Observable<GastoPorCategoria[]> = this.datosFiltrados$.pipe(
    map(({ gastosFiltrados }) => {
      const mapa = new Map<string, number>();
      let total = 0;

      gastosFiltrados.forEach((item) => {
        const monto = Number(item.monto) || 0;
        const cat = item.categoria || 'Varios';
        mapa.set(cat, (mapa.get(cat) || 0) + monto);
        total += monto;
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

  /** Gastos recientes del período activo filtrados por búsqueda */
  readonly gastosRecientes$: Observable<ExpenseItem[]> = combineLatest([
    this.datosFiltrados$,
    this.busquedaSubject.asObservable(),
  ]).pipe(
    map(([{ gastosFiltrados }, busqueda]) => {
      const q = busqueda.trim().toLowerCase();
      const lista = q
        ? gastosFiltrados.filter(
            (g) =>
              g.concepto.toLowerCase().includes(q) ||
              g.categoria.toLowerCase().includes(q) ||
              g.metodoPago.toLowerCase().includes(q)
          )
        : gastosFiltrados;

      return [...lista]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 5);
    })
  );

  /** Presupuestos por categoría sincronizados */
  readonly presupuestos$: Observable<BudgetProgress[]> = this.budgetSvc.presupuestosConProgreso$;

  constructor() {
    // Alertas reactivas en tiempo real derivadas del estado de presupuestos
    this.budgetSvc.presupuestosConProgreso$.subscribe((presupuestos) => {
      const nuevasAlertas: AppNotification[] = [];
      presupuestos.forEach((p) => {
        if (p.porcentajeConsumo >= 100) {
          const id = `notif-pres-100-${p.id}`;
          if (!this.notificacionesLimpiadasIds.has(id)) {
            nuevasAlertas.push({
              id,
              titulo: 'Límite de Presupuesto Excedido',
              mensaje: `El presupuesto para ${p.categoria} ha superado el límite asignado (${p.porcentajeConsumo}%).`,
              leida: false,
              hora: 'Ahora',
              tipo: 'alerta',
            });
          }
        } else if (p.porcentajeConsumo >= 80) {
          const id = `notif-pres-80-${p.id}`;
          if (!this.notificacionesLimpiadasIds.has(id)) {
            nuevasAlertas.push({
              id,
              titulo: 'Alerta de Presupuesto al 80%',
              mensaje: `El consumo en ${p.categoria} ha alcanzado el ${p.porcentajeConsumo}% del límite permitido.`,
              leida: false,
              hora: 'Ahora',
              tipo: 'alerta',
            });
          }
        }
      });

      if (nuevasAlertas.length > 0) {
        this.notificaciones.update((existentes) => {
          const existentesIds = new Set(existentes.map((n) => n.id));
          const agregar = nuevasAlertas.filter((n) => !existentesIds.has(n.id));
          return [...agregar, ...existentes];
        });
      }
    });

    // Notificaciones en tiempo real derivadas de eventos de ahorro
    this.savingsSvc.eventosAhorro$.subscribe((evento: EventoAhorro) => {
      const horaStr = new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
      let notif: AppNotification | null = null;

      if (evento.tipo === 'abono') {
        notif = {
          id: `notif-abono-${Date.now()}`,
          titulo: 'Abono de Ahorro Registrado',
          mensaje: `Se ha acreditado un abono a la meta "${evento.metaTitulo}".`,
          leida: false,
          hora: horaStr,
          tipo: 'exito',
        };
      } else if (evento.tipo === 'nueva_meta') {
        notif = {
          id: `notif-meta-${Date.now()}`,
          titulo: 'Nueva Meta de Ahorro Creada',
          mensaje: `Se ha establecido la meta "${evento.metaTitulo}".`,
          leida: false,
          hora: horaStr,
          tipo: 'info',
        };
      } else if (evento.tipo === 'retiro') {
        notif = {
          id: `notif-retiro-${Date.now()}`,
          titulo: 'Retiro de Ahorro Realizado',
          mensaje: `Se debitaron fondos de la meta "${evento.metaTitulo}" regresando a su balance disponible.`,
          leida: false,
          hora: horaStr,
          tipo: 'info',
        };
      }

      if (notif) {
        this.notificaciones.update((existentes) => [notif!, ...existentes]);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.mostrarDropdownNotif.set(false);
      this.mostrarSelectorCalendario.set(false);
    }
  }

  setPeriod(period: 'Semana' | 'Mes' | 'Año'): void {
    this.activePeriod.set(period);
    this.periodSubject.next(period);
  }

  actualizarBusqueda(texto: string): void {
    this.filtroBusqueda.set(texto);
    this.busquedaSubject.next(texto);
  }

  ejecutarBusqueda(): void {
    this.busquedaSubject.next(this.filtroBusqueda());
  }

  toggleDropdownNotif(event: MouseEvent): void {
    event.stopPropagation();
    this.mostrarDropdownNotif.update((v) => !v);
  }

  toggleSelectorCalendario(event: MouseEvent): void {
    event.stopPropagation();
    this.mostrarSelectorCalendario.update((v) => !v);
  }

  cerrarSelectorCalendario(): void {
    this.mostrarSelectorCalendario.set(false);
  }

  marcarComoLeida(id: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.notificaciones.update((list) =>
      list.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
  }

  limpiarTodasNotificaciones(event?: MouseEvent): void {
    event?.stopPropagation();
    this.notificaciones().forEach((n) => this.notificacionesLimpiadasIds.add(n.id));
    this.notificaciones.set([]);
  }

  logout(): void {
    this.authSvc.logout();
    this.router.navigate(['/login']);
  }

  get userDisplayName(): string {
    const custom = this.settings()?.perfilVisual?.nombreVisualizacion?.trim();
    if (custom) return custom;
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
