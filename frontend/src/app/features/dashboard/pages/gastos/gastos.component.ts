import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExpenseService, ExpenseItem } from '../../../../core/services/expense.service';
import { CategoryService, CategoryItem } from '../../../../core/services/category.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { IncomeService } from '../../../../core/services/income.service';
import { SavingsService } from '../../../../core/services/savings.service';
import { obtenerMesAnioActual, obtenerFechaHoyISO, obtenerFechaCompletaHoy, fechaNoFuturaValidator } from '../../../../core/utils/date.utils';
import { CurrencyConversionPipe } from '../../../../core/pipes/currency-conversion.pipe';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyConversionPipe],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.css'],
})
export class GastosComponent {
  private readonly expenseSvc = inject(ExpenseService);
  private readonly categorySvc = inject(CategoryService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly incomeSvc = inject(IncomeService);
  private readonly savingsSvc = inject(SavingsService);
  private readonly fb = inject(FormBuilder);
  private readonly elementRef = inject(ElementRef);

  readonly fechaHoyISO = obtenerFechaHoyISO();
  readonly fechaCompletaHoy = signal<string>(obtenerFechaCompletaHoy());
  readonly mesAnioActual = signal<string>(obtenerMesAnioActual());
  readonly mostrarSelectorCalendario = signal<boolean>(false);
  readonly simboloMoneda$: Observable<string> = this.settingsSvc.simboloMoneda$;

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
  readonly errorSaldoInsuficiente = signal<string | null>(null);

  readonly gastoForm: FormGroup = this.fb.group({
    concepto: ['', [Validators.required, Validators.minLength(3)]],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    fecha: [this.fechaHoyISO, [Validators.required, fechaNoFuturaValidator]],
    categoria: ['Alimentación', [Validators.required]],
    metodoPago: ['Tarjeta de Débito', [Validators.required]],
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.mostrarSelectorCalendario.set(false);
    }
  }

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

  toggleSelectorCalendario(event: MouseEvent): void {
    event.stopPropagation();
    this.mostrarSelectorCalendario.update((v) => !v);
  }

  cerrarSelectorCalendario(): void {
    this.mostrarSelectorCalendario.set(false);
  }

  seleccionarMes(mesIdx: number): void {
    const fecha = new Date();
    fecha.setMonth(mesIdx);
    this.mesAnioActual.set(obtenerMesAnioActual(fecha));
    this.cerrarSelectorCalendario();
  }

  abrirModalRegistro(): void {
    this.modoEdicion.set(false);
    this.gastoEditandoId.set(null);
    this.errorSaldoInsuficiente.set(null);
    this.gastoForm.reset({
      concepto: '',
      monto: null,
      fecha: this.fechaHoyISO,
      categoria: 'Alimentación',
      metodoPago: 'Tarjeta de Débito',
    });
    this.mostrarModal.set(true);
  }

  editarGasto(item: ExpenseItem): void {
    this.modoEdicion.set(true);
    this.gastoEditandoId.set(item.id);
    this.errorSaldoInsuficiente.set(null);

    const montoConvertido = Number(this.settingsSvc.convertirDesdeGTQ(item.monto).toFixed(2));

    this.gastoForm.patchValue({
      concepto: item.concepto,
      monto: montoConvertido,
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
    this.errorSaldoInsuficiente.set(null);
    this.gastoForm.reset();
  }

  guardarGasto(): void {
    this.errorSaldoInsuficiente.set(null);

    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      return;
    }

    const formVal = this.gastoForm.value;
    const montoIngresado = Number(formVal.monto);

    // ─── Validación de Saldo Insuficiente frente a Liquidez Real ───
    const totalIngresos = this.incomeSvc.snapshot.reduce((acc, i) => acc + (Number(i.monto) || 0), 0);
    const totalGastos = this.expenseSvc.snapshot.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
    const totalAhorrado = this.savingsSvc.snapshot.reduce((acc, a) => acc + (Number(a.montoActual) || 0), 0);

    let gastoPrevio = 0;
    if (this.modoEdicion() && this.gastoEditandoId()) {
      const g = this.expenseSvc.snapshot.find((item) => item.id === this.gastoEditandoId());
      if (g) gastoPrevio = Number(g.monto) || 0;
    }

    const liquidezBaseGTQ = totalIngresos - totalGastos - totalAhorrado + gastoPrevio;
    const liquidezDisponibleEnMoneda = this.settingsSvc.convertirDesdeGTQ(liquidezBaseGTQ);

    if (montoIngresado > Math.max(0, liquidezDisponibleEnMoneda)) {
      this.errorSaldoInsuficiente.set(
        'Operación no permitida: El importe ingresado excede su liquidez disponible actual. No es posible generar saldo negativo.'
      );
      return;
    }

    // Convertir el monto ingresado en la divisa activa a la base GTQ
    const montoBaseGTQ = Number(this.settingsSvc.convertirHaciaGTQ(montoIngresado).toFixed(2));

    const gastoData = {
      concepto: formVal.concepto.trim(),
      monto: montoBaseGTQ,
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
