import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExpenseService, ExpenseItem } from '../../../../core/services/expense.service';
import { CategoryService, CategoryItem } from '../../../../core/services/category.service';
import { obtenerMesAnioActual, obtenerFechaHoyISO } from '../../../../core/utils/date.utils';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.css'],
})
export class GastosComponent {
  private readonly expenseSvc = inject(ExpenseService);
  private readonly categorySvc = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  readonly mesAnioActual = signal<string>(obtenerMesAnioActual());

  // ─── Flujos de métricas ──────────────────────────────────────
  readonly totalGastos$: Observable<number> = this.expenseSvc.totalGastos$;
  readonly promedioDiario$: Observable<number> = this.expenseSvc.promedioDiario$;
  readonly categoriaMayorConsumo$ = this.expenseSvc.categoriaMayorConsumo$;
  readonly categoriasGasto$: Observable<CategoryItem[]> = this.categorySvc.categoriasGasto$;

  // ─── Filtros reactivos ───────────────────────────────────────
  filtroTexto: string = '';
  filtroCategoria: string = '';
  filtroFechaInicio: string = '';
  filtroFechaFin: string = '';

  private readonly filtroTexto$ = new BehaviorSubject<string>('');
  private readonly filtroCategoria$ = new BehaviorSubject<string>('');
  private readonly filtroFechaInicio$ = new BehaviorSubject<string>('');
  private readonly filtroFechaFin$ = new BehaviorSubject<string>('');

  readonly listaGastosFiltrada$: Observable<ExpenseItem[]> = combineLatest([
    this.expenseSvc.gastos$,
    this.filtroTexto$,
    this.filtroCategoria$,
    this.filtroFechaInicio$,
    this.filtroFechaFin$,
  ]).pipe(
    map(([gastos, texto, categoria, inicio, fin]) => {
      return gastos.filter((item) => {
        const coincideTexto =
          !texto ||
          item.concepto.toLowerCase().includes(texto.toLowerCase()) ||
          item.metodoPago.toLowerCase().includes(texto.toLowerCase());

        const coincideCategoria =
          !categoria || item.categoria.toLowerCase() === categoria.toLowerCase();

        const fechaItem = item.fecha;
        const coincideInicio = !inicio || fechaItem >= inicio;
        const coincideFin = !fin || fechaItem <= fin;

        return coincideTexto && coincideCategoria && coincideInicio && coincideFin;
      });
    })
  );

  // ─── Modal de Registro y Edición ─────────────────────────────
  readonly mostrarModal = signal<boolean>(false);
  readonly modoEdicion = signal<boolean>(false);
  readonly gastoEditandoId = signal<string | null>(null);

  readonly gastoForm: FormGroup = this.fb.group({
    concepto: ['', [Validators.required, Validators.minLength(3)]],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    fecha: [new Date().toISOString().split('T')[0], [Validators.required]],
    categoria: ['Alimentación', [Validators.required]],
    metodoPago: ['Tarjeta de Débito', [Validators.required]],
  });

  actualizarFiltros(): void {
    this.filtroTexto$.next(this.filtroTexto);
    this.filtroCategoria$.next(this.filtroCategoria);
    this.filtroFechaInicio$.next(this.filtroFechaInicio);
    this.filtroFechaFin$.next(this.filtroFechaFin);
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroCategoria = '';
    this.filtroFechaInicio = '';
    this.filtroFechaFin = '';
    this.actualizarFiltros();
  }

  abrirModalRegistro(): void {
    this.modoEdicion.set(false);
    this.gastoEditandoId.set(null);
    this.gastoForm.reset({
      concepto: '',
      monto: null,
      fecha: new Date().toISOString().split('T')[0],
      categoria: 'Alimentación',
      metodoPago: 'Tarjeta de Débito',
    });
    this.mostrarModal.set(true);
  }

  editarGasto(item: ExpenseItem): void {
    this.modoEdicion.set(true);
    this.gastoEditandoId.set(item.id);
    this.gastoForm.patchValue({
      concepto: item.concepto,
      monto: item.monto,
      fecha: item.fecha,
      categoria: item.categoria,
      metodoPago: item.metodoPago,
    });
    this.mostrarModal.set(true);
  }

  eliminarGasto(id: string): void {
    if (confirm('¿Está seguro de eliminar este registro de gasto?')) {
      this.expenseSvc.eliminarGasto(id);
    }
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.modoEdicion.set(false);
    this.gastoEditandoId.set(null);
    this.gastoForm.reset();
  }

  guardarGasto(): void {
    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      return;
    }

    const formVal = this.gastoForm.value;
    const gastoData = {
      concepto: formVal.concepto.trim(),
      monto: Number(formVal.monto),
      fecha: formVal.fecha,
      categoria: formVal.categoria,
      metodoPago: formVal.metodoPago,
    };

    if (this.modoEdicion() && this.gastoEditandoId()) {
      this.expenseSvc.actualizarGasto(this.gastoEditandoId()!, gastoData);
    } else {
      this.expenseSvc.agregarGasto(gastoData);
    }

    this.cerrarModal();
  }
}
