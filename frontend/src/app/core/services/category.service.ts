import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExpenseService } from './expense.service';
import { IncomeService } from './income.service';

export interface CategoryItem {
  id: string;
  nombre: string;
  tipo: 'INGRESO' | 'GASTO';
  colorHex: string;
  icono: string; // Identificador de ícono o clave visual
}

const STORAGE_KEY = 'control_gastos_categorias';

export const CATEGORIAS_POR_DEFECTO: CategoryItem[] = [
  { id: 'cat-1', nombre: 'Alimentación', tipo: 'GASTO', colorHex: '#f97316', icono: 'utensils' },
  { id: 'cat-2', nombre: 'Transporte', tipo: 'GASTO', colorHex: '#06b6d4', icono: 'car' },
  { id: 'cat-3', nombre: 'Salud', tipo: 'GASTO', colorHex: '#ec4899', icono: 'heart' },
  { id: 'cat-4', nombre: 'Educación', tipo: 'GASTO', colorHex: '#8b5cf6', icono: 'academic' },
  { id: 'cat-5', nombre: 'Entretenimiento', tipo: 'GASTO', colorHex: '#f59e0b', icono: 'film' },
  { id: 'cat-6', nombre: 'Servicios', tipo: 'GASTO', colorHex: '#3b82f6', icono: 'lightning' },
  { id: 'cat-7', nombre: 'Nómina', tipo: 'INGRESO', colorHex: '#10b981', icono: 'briefcase' },
  { id: 'cat-8', nombre: 'Freelance', tipo: 'INGRESO', colorHex: '#14b8a6', icono: 'laptop' },
  { id: 'cat-9', nombre: 'Consultoría', tipo: 'INGRESO', colorHex: '#a855f7', icono: 'chart' },
];

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly expenseSvc = inject(ExpenseService);
  private readonly incomeSvc = inject(IncomeService);

  private readonly categoriasSubject = new BehaviorSubject<CategoryItem[]>(this.cargarEstadoInicial());

  readonly categorias$: Observable<CategoryItem[]> = this.categoriasSubject.asObservable();

  readonly categoriasGasto$: Observable<CategoryItem[]> = this.categorias$.pipe(
    map((lista) => lista.filter((item) => item.tipo === 'GASTO'))
  );

  readonly categoriasIngreso$: Observable<CategoryItem[]> = this.categorias$.pipe(
    map((lista) => lista.filter((item) => item.tipo === 'INGRESO'))
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
          const actualizados = this.cargarEstadoInicial();
          this.categoriasSubject.next(actualizados);
        }
      });
    }
  }

  private cargarEstadoInicial(): CategoryItem[] {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        return JSON.parse(guardado) as CategoryItem[];
      }
    } catch {
      // Usar lista por defecto si hay falla de deserialización
    }
    return [...CATEGORIAS_POR_DEFECTO];
  }

  private persistirEstado(lista: CategoryItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn('[CategoryService] No se pudo guardar en localStorage', e);
    }
  }

  get snapshot(): CategoryItem[] {
    return this.categoriasSubject.getValue();
  }

  /** Determina si una categoría tiene transacciones activas asociadas */
  categoriaEnUso(nombre: string, tipo: 'INGRESO' | 'GASTO'): boolean {
    const nombreNormalizado = nombre.trim().toLowerCase();
    if (tipo === 'GASTO') {
      return this.expenseSvc.snapshot.some(
        (gasto) => gasto.categoria.trim().toLowerCase() === nombreNormalizado
      );
    } else {
      return this.incomeSvc.snapshot.some(
        (ingreso) =>
          ingreso.fuente.trim().toLowerCase().includes(nombreNormalizado) ||
          ingreso.concepto.trim().toLowerCase().includes(nombreNormalizado)
      );
    }
  }

  agregarCategoria(nueva: Omit<CategoryItem, 'id'>): CategoryItem {
    const item: CategoryItem = {
      ...nueva,
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nombre: nueva.nombre.trim(),
    };

    const actualizados = [...this.categoriasSubject.getValue(), item];
    this.categoriasSubject.next(actualizados);
    this.persistirEstado(actualizados);
    return item;
  }

  actualizarCategoria(id: string, cambios: Partial<CategoryItem>): void {
    const actualizados = this.categoriasSubject.getValue().map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...cambios,
          nombre: cambios.nombre !== undefined ? cambios.nombre.trim() : item.nombre,
        };
      }
      return item;
    });

    this.categoriasSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  eliminarCategoria(id: string): { exitoso: boolean; motivo?: string } {
    const item = this.categoriasSubject.getValue().find((c) => c.id === id);
    if (!item) {
      return { exitoso: false, motivo: 'La categoría no existe.' };
    }

    if (this.categoriaEnUso(item.nombre, item.tipo)) {
      return {
        exitoso: false,
        motivo: `No es posible eliminar la categoría "${item.nombre}" porque contiene transacciones financieras activas asociadas.`,
      };
    }

    const actualizados = this.categoriasSubject.getValue().filter((c) => c.id !== id);
    this.categoriasSubject.next(actualizados);
    this.persistirEstado(actualizados);
    return { exitoso: true };
  }

  restablecerCategorias(): void {
    this.categoriasSubject.next([...CATEGORIAS_POR_DEFECTO]);
    this.persistirEstado(CATEGORIAS_POR_DEFECTO);
  }
}
