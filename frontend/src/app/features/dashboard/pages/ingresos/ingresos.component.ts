import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IncomeService, IncomeItem, ColumnaSemanal } from '../../../../core/services/income.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { obtenerMesAnioActual, obtenerFechaHoyISO, obtenerFechaCompletaHoy, fechaNoFuturaValidator } from '../../../../core/utils/date.utils';
import { CurrencyConversionPipe } from '../../../../core/pipes/currency-conversion.pipe';

@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyConversionPipe],
  templateUrl: './ingresos.component.html',
  styleUrls: ['./ingresos.component.css'],
})
export class IngresosComponent {
  private readonly incomeSvc = inject(IncomeService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly fb = inject(FormBuilder);
  private readonly elementRef = inject(ElementRef);

  readonly fechaHoyISO = obtenerFechaHoyISO();
  readonly fechaCompletaHoy = signal<string>(obtenerFechaCompletaHoy());
  readonly mesAnioActual = signal<string>(obtenerMesAnioActual());
  readonly mostrarSelectorCalendario = signal<boolean>(false);
  readonly simboloMoneda$: Observable<string> = this.settingsSvc.simboloMoneda$;

  // ─── Selector de Vista del Histograma ────────────────────────
  readonly vistaPeriodo = signal<'semanal' | 'quincenal'>('semanal');

  // ─── Observables de métricas directas del servicio ──────────
  readonly totalIngresos$: Observable<number> = this.incomeSvc.totalIngresos$;
  readonly totalNomina$: Observable<number> = this.incomeSvc.totalNomina$;
  readonly conteoNomina$: Observable<number> = this.incomeSvc.conteoNomina$;
  readonly totalDesarrollo$: Observable<number> = this.incomeSvc.totalDesarrollo$;
  readonly totalConsultoria$: Observable<number> = this.incomeSvc.totalConsultoria$;
  readonly columnasSemanales$: Observable<ColumnaSemanal[]> = this.incomeSvc.columnasSemanales$;
  readonly columnasQuincenales$: Observable<ColumnaSemanal[]> = this.incomeSvc.columnasQuincenales$;
  readonly promedioSemanal$: Observable<number> = this.incomeSvc.promedioSemanal$;

  setVistaPeriodo(periodo: 'semanal' | 'quincenal'): void {
    this.vistaPeriodo.set(periodo);
  }

  // ─── Filtros de búsqueda ─────────────────────────────────────
  filtroTexto: string = '';
  filtroFuente: string = '';

  private readonly filtroTexto$ = new BehaviorSubject<string>('');
  private readonly filtroFuente$ = new BehaviorSubject<string>('');

  /** Lista de ingresos filtrada reactivamente */
  readonly listaIngresosFiltrada$: Observable<IncomeItem[]> = combineLatest([
    this.incomeSvc.ingresos$,
    this.filtroTexto$,
    this.filtroFuente$,
  ]).pipe(
    map(([ingresos, texto, fuente]) => {
      return ingresos.filter((item) => {
        const coincideTexto =
          !texto ||
          item.concepto.toLowerCase().includes(texto.toLowerCase()) ||
          item.fuente.toLowerCase().includes(texto.toLowerCase());

        const coincideFuente =
          !fuente || item.fuente.toLowerCase() === fuente.toLowerCase();

        return coincideTexto && coincideFuente;
      });
    })
  );

  // ─── Estado del Modal de Registro/Edición ────────────────────
  readonly mostrarModal = signal<boolean>(false);
  readonly modoEdicion = signal<boolean>(false);
  readonly ingresoEditandoId = signal<string | null>(null);

  readonly ingresoForm: FormGroup = this.fb.group({
    concepto: ['', [Validators.required, Validators.minLength(3)]],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    fecha: [this.fechaHoyISO, [Validators.required, fechaNoFuturaValidator]],
    fuente: ['Nómina Fija', [Validators.required]],
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.mostrarSelectorCalendario.set(false);
    }
  }

  formatearFechaDisplay(fechaStr: string): string {
    if (!fechaStr) return '';
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
  }

  actualizarFiltros(): void {
    this.filtroTexto$.next(this.filtroTexto);
    this.filtroFuente$.next(this.filtroFuente);
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
    this.ingresoEditandoId.set(null);
    this.ingresoForm.reset({
      concepto: '',
      monto: null,
      fecha: this.fechaHoyISO,
      fuente: 'Nómina Fija',
    });
    this.mostrarModal.set(true);
  }

  editarIngreso(item: IncomeItem): void {
    this.modoEdicion.set(true);
    this.ingresoEditandoId.set(item.id);

    const montoConvertido = Number(this.settingsSvc.convertirDesdeGTQ(item.monto).toFixed(2));

    this.ingresoForm.patchValue({
      concepto: item.concepto,
      monto: montoConvertido,
      fecha: item.fecha,
      fuente: item.fuente,
    });
    this.mostrarModal.set(true);
  }

  eliminarIngreso(id: string): void {
    if (confirm('¿Está seguro de eliminar este registro de ingreso?')) {
      this.incomeSvc.eliminarIngreso(id);
    }
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.modoEdicion.set(false);
    this.ingresoEditandoId.set(null);
    this.ingresoForm.reset();
  }

  guardarIngreso(): void {
    if (this.ingresoForm.invalid) {
      this.ingresoForm.markAllAsTouched();
      return;
    }

    const formVal = this.ingresoForm.value;
    const montoIngresado = Number(formVal.monto);
    const montoBaseGTQ = Number(this.settingsSvc.convertirHaciaGTQ(montoIngresado).toFixed(2));

    const ingresoData = {
      concepto: formVal.concepto.trim(),
      monto: montoBaseGTQ,
      fecha: formVal.fecha,
      fuente: formVal.fuente,
    };

    if (this.modoEdicion() && this.ingresoEditandoId()) {
      this.incomeSvc.actualizarIngreso(this.ingresoEditandoId()!, ingresoData);
    } else {
      this.incomeSvc.agregarIngreso(ingresoData);
    }

    this.cerrarModal();
  }
}
