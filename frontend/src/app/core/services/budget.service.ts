import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExpenseService } from './expense.service';

export interface BudgetItem {
  id: string;
  categoria: string;
  montoLimite: number;
  periodo: 'Mensual' | 'Semanal' | 'Anual' | string;
}

export interface BudgetProgress {
  id: string;
  categoria: string;
  montoLimite: number;
  montoEjecutado: number;
  porcentajeConsumo: number; // 0 a 100 o más
  desbordado: boolean;
  estadoColor: 'cyan' | 'amber' | 'rose';
  restante: number;
  periodo: string;
}

const STORAGE_KEY = 'control_gastos_presupuestos';

export const PRESUPUESTOS_POR_DEFECTO: BudgetItem[] = [
  { id: 'pres-1', categoria: 'Alimentación', montoLimite: 2500, periodo: 'Mensual' },
  { id: 'pres-2', categoria: 'Transporte', montoLimite: 1200, periodo: 'Mensual' },
  { id: 'pres-3', categoria: 'Entretenimiento', montoLimite: 800, periodo: 'Mensual' },
  { id: 'pres-4', categoria: 'Salud', montoLimite: 1000, periodo: 'Mensual' },
  { id: 'pres-5', categoria: 'Servicios', montoLimite: 1500, periodo: 'Mensual' },
  { id: 'pres-6', categoria: 'Educación', montoLimite: 1800, periodo: 'Mensual' },
];

@Injectable({
  providedIn: 'root',
})
export class BudgetService {
  private readonly expenseSvc = inject(ExpenseService);

  private readonly presupuestosSubject = new BehaviorSubject<BudgetItem[]>(this.cargarEstadoInicial());

  readonly presupuestos$: Observable<BudgetItem[]> = this.presupuestosSubject.asObservable();

  /** Flujo reactivo que combina los presupuestos fijados con los gastos reales ejecutados */
  readonly presupuestosConProgreso$: Observable<BudgetProgress[]> = combineLatest([
    this.presupuestos$,
    this.expenseSvc.gastos$,
  ]).pipe(
    map(([presupuestos, gastos]) => {
      return presupuestos.map((item) => {
        const montoEjecutado = gastos
          .filter((g) => g.categoria.trim().toLowerCase() === item.categoria.trim().toLowerCase())
          .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

        const limite = Number(item.montoLimite) || 0;
        const porcentaje = limite > 0 ? (montoEjecutado / limite) * 100 : 0;
        const porcentajeRedondeado = Math.round(porcentaje);
        const desbordado = montoEjecutado > limite;

        let estadoColor: 'cyan' | 'amber' | 'rose' = 'cyan';
        if (porcentaje >= 90) {
          estadoColor = 'rose';
        } else if (porcentaje >= 70) {
          estadoColor = 'amber';
        }

        return {
          id: item.id,
          categoria: item.categoria,
          montoLimite: limite,
          montoEjecutado,
          porcentajeConsumo: porcentajeRedondeado,
          desbordado,
          estadoColor,
          restante: Math.max(0, limite - montoEjecutado),
          periodo: item.periodo,
        };
      });
    })
  );

  /** Total presupuestado consolidado */
  readonly totalPresupuestado$: Observable<number> = this.presupuestos$.pipe(
    map((lista) => lista.reduce((acc, item) => acc + (Number(item.montoLimite) || 0), 0))
  );

  /** Total ejecutado global sobre las categorías con presupuesto */
  readonly totalEjecutado$: Observable<number> = this.presupuestosConProgreso$.pipe(
    map((lista) => lista.reduce((acc, item) => acc + item.montoEjecutado, 0))
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
          const actualizados = this.cargarEstadoInicial();
          this.presupuestosSubject.next(actualizados);
        }
      });
    }
  }

  private cargarEstadoInicial(): BudgetItem[] {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        return JSON.parse(guardado) as BudgetItem[];
      }
    } catch {
      // Fallback
    }
    return [...PRESUPUESTOS_POR_DEFECTO];
  }

  private persistirEstado(lista: BudgetItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn('[BudgetService] No se pudo guardar en localStorage', e);
    }
  }

  get snapshot(): BudgetItem[] {
    return this.presupuestosSubject.getValue();
  }

  agregarPresupuesto(nuevo: Omit<BudgetItem, 'id'>): BudgetItem {
    const item: BudgetItem = {
      ...nuevo,
      id: `pres-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      montoLimite: Number(nuevo.montoLimite) || 0,
    };

    const actualizados = [...this.presupuestosSubject.getValue(), item];
    this.presupuestosSubject.next(actualizados);
    this.persistirEstado(actualizados);
    return item;
  }

  actualizarLimite(id: string, nuevoLimite: number): void {
    const actualizados = this.presupuestosSubject.getValue().map((item) => {
      if (item.id === id) {
        return {
          ...item,
          montoLimite: Number(nuevoLimite) || 0,
        };
      }
      return item;
    });

    this.presupuestosSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  eliminarPresupuesto(id: string): void {
    const actualizados = this.presupuestosSubject.getValue().filter((item) => item.id !== id);
    this.presupuestosSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  resetearLimites(): void {
    this.presupuestosSubject.next([...PRESUPUESTOS_POR_DEFECTO]);
    this.persistirEstado(PRESUPUESTOS_POR_DEFECTO);
  }
}
