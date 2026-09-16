import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface IncomeItem {
  id: string;
  fecha: string; // Formato YYYY-MM-DD
  concepto: string;
  fuente: 'Nómina Fija' | 'Desarrollo Web' | 'Consultoría' | string;
  monto: number;
}

export interface ColumnaSemanal {
  monto: number;
  porcentajeAltura: number;
  rango: string;
  etiqueta: string;
  subtexto?: string;
  esDestacado?: boolean;
}

const STORAGE_KEY = 'control_gastos_ingresos';

@Injectable({
  providedIn: 'root',
})
export class IncomeService {
  // Estado inicial sincronizado con el almacenamiento local o baseline de maqueta
  private readonly ingresosSubject = new BehaviorSubject<IncomeItem[]>(this.cargarEstadoInicial());

  /** Flujo reactivo principal de todos los ingresos */
  readonly ingresos$: Observable<IncomeItem[]> = this.ingresosSubject.asObservable();

  /** Total percibido en el mes (Suma de todos los ingresos) */
  readonly totalIngresos$: Observable<number> = this.ingresos$.pipe(
    map((lista) => lista.reduce((acc, item) => acc + (Number(item.monto) || 0), 0))
  );

  /** Total por Nómina Fija */
  readonly totalNomina$: Observable<number> = this.ingresos$.pipe(
    map((lista) =>
      lista
        .filter((item) => item.fuente === 'Nómina Fija')
        .reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    )
  );

  /** Conteo dinámico de depósitos de nómina */
  readonly conteoNomina$: Observable<number> = this.ingresos$.pipe(
    map((lista) => lista.filter((item) => item.fuente === 'Nómina Fija').length)
  );

  /** Total por Desarrollo Web & Hosting */
  readonly totalDesarrollo$: Observable<number> = this.ingresos$.pipe(
    map((lista) =>
      lista
        .filter((item) => item.fuente.toLowerCase().includes('desarrollo'))
        .reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    )
  );

  /** Total por Consultorías de Sistemas */
  readonly totalConsultoria$: Observable<number> = this.ingresos$.pipe(
    map((lista) =>
      lista
        .filter((item) => item.fuente.toLowerCase().includes('consultor'))
        .reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    )
  );

  /** Histograma de captación semanal recalculado automáticamente con 4 columnas */
  readonly columnasSemanales$: Observable<ColumnaSemanal[]> = this.ingresos$.pipe(
    map((lista) => {
      const ahora = new Date();
      const mesAbrev = ahora.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '');
      const mesCap = mesAbrev.charAt(0).toUpperCase() + mesAbrev.slice(1);

      const semanas = [
        { rango: `1 – 7 ${mesCap}`, etiqueta: 'Semana 1', subtexto: 'Nómina Q1', start: 1, end: 7, monto: 0, esDestacado: false },
        { rango: `8 – 14 ${mesCap}`, etiqueta: 'Semana 2', subtexto: 'Consultoría TI', start: 8, end: 14, monto: 0, esDestacado: false },
        { rango: `15 – 21 ${mesCap}`, etiqueta: 'Semana 3', subtexto: 'Nómina Q2', start: 15, end: 21, monto: 0, esDestacado: false },
        { rango: `22 – 31 ${mesCap}`, etiqueta: 'Semana 4', subtexto: 'Desarrollo Web', start: 22, end: 31, monto: 0, esDestacado: true },
      ];

      lista.forEach((item) => {
        const dia = item.fecha ? parseInt(item.fecha.split('-')[2] || '1', 10) : 1;
        const monto = Number(item.monto) || 0;
        const sem = semanas.find((s) => dia >= s.start && dia <= s.end);
        if (sem) {
          sem.monto += monto;
        } else {
          semanas[0].monto += monto;
        }
      });

      const maxMonto = Math.max(...semanas.map((s) => s.monto), 0);

      return semanas.map((s) => ({
        monto: s.monto,
        porcentajeAltura: maxMonto > 0 && s.monto > 0 ? Math.max(16, Math.round((s.monto / maxMonto) * 100)) : 0,
        rango: s.rango,
        etiqueta: s.etiqueta,
        subtexto: s.subtexto,
        esDestacado: s.esDestacado,
      }));
    })
  );

  /** Histograma alternativo para vista quincenal interactiva */
  readonly columnasQuincenales$: Observable<ColumnaSemanal[]> = this.ingresos$.pipe(
    map((lista) => {
      const ahora = new Date();
      const mesAbrev = ahora.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '');
      const mesCap = mesAbrev.charAt(0).toUpperCase() + mesAbrev.slice(1);

      const quincenas = [
        { rango: `1 – 15 ${mesCap}`, etiqueta: 'Quincena 1', subtexto: 'Nómina Q1 & Consultoría', start: 1, end: 15, monto: 0, esDestacado: false },
        { rango: `16 – 31 ${mesCap}`, etiqueta: 'Quincena 2', subtexto: 'Nómina Q2 & Desarrollo Web', start: 16, end: 31, monto: 0, esDestacado: true },
      ];

      lista.forEach((item) => {
        const dia = item.fecha ? parseInt(item.fecha.split('-')[2] || '1', 10) : 1;
        const monto = Number(item.monto) || 0;
        const q = quincenas.find((s) => dia >= s.start && dia <= s.end);
        if (q) {
          q.monto += monto;
        } else {
          quincenas[0].monto += monto;
        }
      });

      const maxMonto = Math.max(...quincenas.map((q) => q.monto), 0);

      return quincenas.map((q) => ({
        monto: q.monto,
        porcentajeAltura: maxMonto > 0 && q.monto > 0 ? Math.max(16, Math.round((q.monto / maxMonto) * 100)) : 0,
        rango: q.rango,
        etiqueta: q.etiqueta,
        subtexto: q.subtexto,
        esDestacado: q.esDestacado,
      }));
    })
  );

  /** Promedio por ciclo semanal (Total / 4 ciclos) */
  readonly promedioSemanal$: Observable<number> = this.totalIngresos$.pipe(
    map((total) => (total > 0 ? total / 4 : 0))
  );

  constructor() {
    // Sincronizar en tiempo real si el almacenamiento local cambia en otra ventana o pestaña
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
          const actualizados = this.cargarEstadoInicial();
          this.ingresosSubject.next(actualizados);
        }
      });
    }
  }

  /** Carga inicial respetando baseline o cargando mockup de referencia */
  private cargarEstadoInicial(): IncomeItem[] {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado !== null) {
        return JSON.parse(guardado) as IncomeItem[];
      }
    } catch {
      // Ignorar error de parseo y arrancar en lista vacia
    }
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mesStr = String(ahora.getMonth() + 1).padStart(2, '0');

    return [
      {
        id: 'ing-mock-1',
        fecha: `${anio}-${mesStr}-22`,
        concepto: 'Mantenimiento y Hosting Cloud',
        fuente: 'Desarrollo Web',
        monto: 3500,
      },
      {
        id: 'ing-mock-2',
        fecha: `${anio}-${mesStr}-15`,
        concepto: 'Pago Nómina Quincenal (Segunda)',
        fuente: 'Nómina Fija',
        monto: 6250,
      },
      {
        id: 'ing-mock-3',
        fecha: `${anio}-${mesStr}-10`,
        concepto: 'Auditoría Técnica de Servidor',
        fuente: 'Consultoría',
        monto: 2200,
      },
      {
        id: 'ing-mock-4',
        fecha: `${anio}-${mesStr}-01`,
        concepto: 'Pago Nómina Quincenal (Primera)',
        fuente: 'Nómina Fija',
        monto: 6250,
      },
    ];
  }

  private persistirEstado(lista: IncomeItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn('[IncomeService] No se pudo guardar en localStorage', e);
    }
  }

  /** Snapshot síncrono */
  get snapshot(): IncomeItem[] {
    return this.ingresosSubject.getValue();
  }

  /** Agrega un nuevo ingreso de forma reactiva */
  agregarIngreso(nuevo: Omit<IncomeItem, 'id'>): IncomeItem {
    const item: IncomeItem = {
      ...nuevo,
      id: `ing-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      monto: Number(nuevo.monto) || 0,
    };

    const actualizados = [item, ...this.ingresosSubject.getValue()];
    this.ingresosSubject.next(actualizados);
    this.persistirEstado(actualizados);
    return item;
  }

  /** Actualiza un ingreso existente */
  actualizarIngreso(id: string, cambios: Partial<IncomeItem>): void {
    const actualizados = this.ingresosSubject.getValue().map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...cambios,
          monto: cambios.monto !== undefined ? Number(cambios.monto) : item.monto,
        };
      }
      return item;
    });

    this.ingresosSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  /** Elimina un ingreso por su ID */
  eliminarIngreso(id: string): void {
    const actualizados = this.ingresosSubject.getValue().filter((item) => item.id !== id);
    this.ingresosSubject.next(actualizados);
    this.persistirEstado(actualizados);
  }

  /** Reinicia el estado a cero */
  limpiarIngresos(): void {
    this.ingresosSubject.next([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Restaura la lista completa de ingresos (p. ej. desde un respaldo JSON) */
  restaurarIngresos(items: IncomeItem[]): void {
    const limpios = (items || []).map((item) => ({
      ...item,
      monto: Number(item.monto) || 0,
    }));
    this.ingresosSubject.next(limpios);
    this.persistirEstado(limpios);
  }
}

