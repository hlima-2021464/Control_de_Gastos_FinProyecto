import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SavingGoal {
  id: string;
  titulo: string;
  montoObjetivo: number;
  montoActual: number;
  fechaLimite: string; // Formato YYYY-MM-DD
  colorHex?: string;
}

const STORAGE_KEY = 'control_gastos_ahorro';

@Injectable({
  providedIn: 'root',
})
export class SavingsService {
  // Baseline en cero ($Q 0.00)
  private readonly metasSubject = new BehaviorSubject<SavingGoal[]>(this.cargarEstadoInicial());

  readonly metas$: Observable<SavingGoal[]> = this.metasSubject.asObservable();

  /** Total acumulado efectivamente en todas las metas de ahorro */
  readonly totalAhorrado$: Observable<number> = this.metas$.pipe(
    map((lista) => lista.reduce((acc, item) => acc + (Number(item.montoActual) || 0), 0))
  );

  /** Total objetivo sumado de todas las metas */
  readonly totalObjetivo$: Observable<number> = this.metas$.pipe(
    map((lista) => lista.reduce((acc, item) => acc + (Number(item.montoObjetivo) || 0), 0))
  );

  /** Porcentaje global de cumplimiento de las metas de ahorro */
  readonly porcentajeCumplimientoGlobal$: Observable<number> = this.metas$.pipe(
    map((lista) => {
      const objetivoTotal = lista.reduce((acc, item) => acc + (Number(item.montoObjetivo) || 0), 0);
      const ahorradoTotal = lista.reduce((acc, item) => acc + (Number(item.montoActual) || 0), 0);
      if (objetivoTotal <= 0) return 0;
      return Math.min(100, Math.round((ahorradoTotal / objetivoTotal) * 100));
    })
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
          const actualizados = this.cargarEstadoInicial();
          this.metasSubject.next(actualizados);
        }
      });
    }
  }

  private cargarEstadoInicial(): SavingGoal[] {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        return JSON.parse(guardado) as SavingGoal[];
      }
    } catch {
      // Fallback
    }
    return [];
  }

  private persistirEstado(lista: SavingGoal[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn('[SavingsService] No se pudo guardar en localStorage', e);
    }
  }

  get snapshot(): SavingGoal[] {
    return this.metasSubject.getValue();
  }

  agregarMeta(nueva: Omit<SavingGoal, 'id' | 'montoActual'> & { montoActual?: number }): SavingGoal {
    const item: SavingGoal = {
      ...nueva,
      id: `meta-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      montoObjetivo: Number(nueva.montoObjetivo) || 0,
      montoActual: Number(nueva.montoActual) || 0,
      colorHex: nueva.colorHex || '#10b981',
    };

    const actualizados = [item, ...this.metasSubject.getValue()];
    this.metasSubject.next(actualizados);
    this.persistirEstado(actualizados);
    return item;
  }

  actualizarMeta(id: string, cambios: Partial<SavingGoal>): void {
    const actualizados = this.metasSubject.getValue().map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...cambios,
          montoObjetivo: cambios.montoObjetivo !== undefined ? Number(cambios.montoObjetivo) : item.montoObjetivo,
          montoActual: cambios.montoActual !== undefined ? Number(cambios.montoActual) : item.montoActual,
        };
      }
      return item;
    });

    this.metasSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  abonarAMeta(id: string, montoAbono: number): void {
    const monto = Number(montoAbono) || 0;
    if (monto <= 0) return;

    const actualizados = this.metasSubject.getValue().map((item) => {
      if (item.id === id) {
        return {
          ...item,
          montoActual: (Number(item.montoActual) || 0) + monto,
        };
      }
      return item;
    });

    this.metasSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  eliminarMeta(id: string): void {
    const actualizados = this.metasSubject.getValue().filter((item) => item.id !== id);
    this.metasSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  limpiarMetas(): void {
    this.metasSubject.next([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // No-op
    }
  }
}
