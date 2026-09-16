import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ExpenseItem {
  id: string;
  concepto: string;
  monto: number;
  fecha: string; // Formato YYYY-MM-DD
  categoria: string;
  metodoPago: 'Tarjeta de Crédito' | 'Tarjeta de Débito' | 'Transferencia' | 'Efectivo' | string;
}

export interface GastoPorCategoria {
  categoria: string;
  total: number;
  porcentaje: number;
}

const STORAGE_KEY = 'control_gastos_gastos';

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  // Baseline inicial estricto en cero ($Q 0.00) y lista vacía
  private readonly gastosSubject = new BehaviorSubject<ExpenseItem[]>(this.cargarEstadoInicial());

  /** Flujo reactivo principal de todos los gastos */
  readonly gastos$: Observable<ExpenseItem[]> = this.gastosSubject.asObservable();

  /** Total acumulado de gastos */
  readonly totalGastos$: Observable<number> = this.gastos$.pipe(
    map((lista) => lista.reduce((acc, item) => acc + (Number(item.monto) || 0), 0))
  );

  /** Desglose consolidado por categoría con cálculo porcentual */
  readonly gastosPorCategoria$: Observable<GastoPorCategoria[]> = this.gastos$.pipe(
    map((lista) => {
      const acumuladoPorCat = new Map<string, number>();
      let totalGasto = 0;

      lista.forEach((item) => {
        const monto = Number(item.monto) || 0;
        totalGasto += monto;
        const actual = acumuladoPorCat.get(item.categoria) || 0;
        acumuladoPorCat.set(item.categoria, actual + monto);
      });

      const resultado: GastoPorCategoria[] = [];
      acumuladoPorCat.forEach((total, categoria) => {
        resultado.push({
          categoria,
          total,
          porcentaje: totalGasto > 0 ? Math.round((total / totalGasto) * 100) : 0,
        });
      });

      return resultado.sort((a, b) => b.total - a.total);
    })
  );

  /** Gastos recientes ordenados cronológicamente descendente (máximo 5) */
  readonly gastosRecientes$: Observable<ExpenseItem[]> = this.gastos$.pipe(
    map((lista) =>
      [...lista]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 5)
    )
  );

  /** Promedio de gasto diario calculado en base al mes (30 días) */
  readonly promedioDiario$: Observable<number> = this.totalGastos$.pipe(
    map((total) => (total > 0 ? total / 30 : 0))
  );

  /** Categoría con mayor volumen de gasto */
  readonly categoriaMayorConsumo$: Observable<{ categoria: string; total: number } | null> = this.gastosPorCategoria$.pipe(
    map((categorias) => (categorias.length > 0 ? { categoria: categorias[0].categoria, total: categorias[0].total } : null))
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
          const actualizados = this.cargarEstadoInicial();
          this.gastosSubject.next(actualizados);
        }
      });
    }
  }

  private cargarEstadoInicial(): ExpenseItem[] {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        return JSON.parse(guardado) as ExpenseItem[];
      }
    } catch {
      // Ignorar error de deserialización
    }
    return [];
  }

  private persistirEstado(lista: ExpenseItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn('[ExpenseService] No se pudo guardar en localStorage', e);
    }
  }

  get snapshot(): ExpenseItem[] {
    return this.gastosSubject.getValue();
  }

  agregarGasto(nuevo: Omit<ExpenseItem, 'id'>): ExpenseItem {
    const item: ExpenseItem = {
      ...nuevo,
      id: `gst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      monto: Number(nuevo.monto) || 0,
    };

    const actualizados = [item, ...this.gastosSubject.getValue()];
    this.gastosSubject.next(actualizados);
    this.persistirEstado(actualizados);
    return item;
  }

  actualizarGasto(id: string, cambios: Partial<ExpenseItem>): void {
    const actualizados = this.gastosSubject.getValue().map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...cambios,
          monto: cambios.monto !== undefined ? Number(cambios.monto) : item.monto,
        };
      }
      return item;
    });

    this.gastosSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  eliminarGasto(id: string): void {
    const actualizados = this.gastosSubject.getValue().filter((item) => item.id !== id);
    this.gastosSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  limpiarGastos(): void {
    this.gastosSubject.next([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // No-op
    }
  }

  /** Restaura la lista completa de gastos (p. ej. desde un respaldo JSON) */
  restaurarGastos(items: ExpenseItem[]): void {
    const limpios = (items || []).map((item) => ({
      ...item,
      monto: Number(item.monto) || 0,
    }));
    this.gastosSubject.next(limpios);
    this.persistirEstado(limpios);
  }
}

