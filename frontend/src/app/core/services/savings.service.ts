import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SavingGoal {
  id: string;
  titulo: string;
  montoObjetivo: number;
  montoActual: number;
  fechaLimite: string; // Formato YYYY-MM-DD
  colorHex?: string;
}

export interface EventoAhorro {
  tipo: 'abono' | 'nueva_meta' | 'retiro';
  metaTitulo: string;
  monto?: number;
  fecha: Date;
}

const STORAGE_KEY = 'control_gastos_ahorro';

@Injectable({
  providedIn: 'root',
})
export class SavingsService {
  // Baseline en cero ($Q 0.00)
  private readonly metasSubject = new BehaviorSubject<SavingGoal[]>(this.cargarEstadoInicial());
  private readonly eventosSubject = new Subject<EventoAhorro>();

  readonly metas$: Observable<SavingGoal[]> = this.metasSubject.asObservable();
  readonly eventosAhorro$: Observable<EventoAhorro> = this.eventosSubject.asObservable();

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
    this.eventosSubject.next({
      tipo: 'nueva_meta',
      metaTitulo: item.titulo,
      monto: item.montoObjetivo,
      fecha: new Date(),
    });
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

    let metaNombre = '';
    const actualizados = this.metasSubject.getValue().map((item) => {
      if (item.id === id) {
        metaNombre = item.titulo;
        return {
          ...item,
          montoActual: (Number(item.montoActual) || 0) + monto,
        };
      }
      return item;
    });

    this.metasSubject.next(actualizados);
    this.persistirEstado(actualizados);

    this.eventosSubject.next({
      tipo: 'abono',
      metaTitulo: metaNombre,
      monto,
      fecha: new Date(),
    });
  }

  retirarDeMeta(id: string, montoRetiro: number): boolean {
    const monto = Number(montoRetiro) || 0;
    if (monto <= 0) return false;

    const actual = this.metasSubject.getValue().find((m) => m.id === id);
    if (!actual || actual.montoActual < monto) {
      return false;
    }

    const actualizados = this.metasSubject.getValue().map((item) => {
      if (item.id === id) {
        return {
          ...item,
          montoActual: Math.max(0, (Number(item.montoActual) || 0) - monto),
        };
      }
      return item;
    });

    this.metasSubject.next(actualizados);
    this.persistirEstado(actualizados);

    this.eventosSubject.next({
      tipo: 'retiro',
      metaTitulo: actual.titulo,
      monto,
      fecha: new Date(),
    });

    return true;
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

  /** Restaura la lista completa de metas de ahorro (p. ej. desde un respaldo JSON) */
  restaurarMetas(items: SavingGoal[]): void {
    const limpios = (items || []).map((item) => ({
      ...item,
      montoActual: Number(item.montoActual) || 0,
      montoObjetivo: Number(item.montoObjetivo) || 0,
    }));
    this.metasSubject.next(limpios);
    this.persistirEstado(limpios);
  }
}

