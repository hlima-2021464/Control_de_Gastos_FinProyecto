import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IncomeService, IncomeItem, ColumnaSemanal } from '../../../../core/services/income.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { obtenerMesAnioActual } from '../../../../core/utils/date.utils';

@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ingresos.component.html',
  styleUrls: ['./ingresos.component.css'],
})
export class IngresosComponent {
  private readonly incomeSvc = inject(IncomeService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly fb = inject(FormBuilder);

  readonly mesAnioActual = signal<string>(obtenerMesAnioActual());
  readonly simboloMoneda$: Observable<string> = this.settingsSvc.simboloMoneda$;


  // ─── Observables de métricas directas del servicio ──────────
  readonly totalIngresos$: Observable<number> = this.incomeSvc.totalIngresos$;
  readonly totalNomina$: Observable<number> = this.incomeSvc.totalNomina$;
  readonly totalDesarrollo$: Observable<number> = this.incomeSvc.totalDesarrollo$;
  readonly totalConsultoria$: Observable<number> = this.incomeSvc.totalConsultoria$;
  readonly columnasSemanales$: Observable<ColumnaSemanal[]> = this.incomeSvc.columnasSemanales$;
  readonly promedioSemanal$: Observable<number> = this.incomeSvc.promedioSemanal$;

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
          item.cuentaDestino.toLowerCase().includes(texto.toLowerCase());

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
    fecha: [new Date().toISOString().split('T')[0], [Validators.required]],
    fuente: ['Nómina Fija', [Validators.required]],
    cuentaDestino: ['Cuenta Monetaria BAC', [Validators.required]],
  });

  actualizarFiltros(): void {
    this.filtroTexto$.next(this.filtroTexto);
    this.filtroFuente$.next(this.filtroFuente);
  }

  abrirModalRegistro(): void {
    this.modoEdicion.set(false);
    this.ingresoEditandoId.set(null);
    this.ingresoForm.reset({
      concepto: '',
      monto: null,
      fecha: new Date().toISOString().split('T')[0],
      fuente: 'Nómina Fija',
      cuentaDestino: 'Cuenta Monetaria BAC',
    });
    this.mostrarModal.set(true);
  }

  editarIngreso(item: IncomeItem): void {
    this.modoEdicion.set(true);
    this.ingresoEditandoId.set(item.id);
    this.ingresoForm.patchValue({
      concepto: item.concepto,
      monto: item.monto,
      fecha: item.fecha,
      fuente: item.fuente,
      cuentaDestino: item.cuentaDestino,
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
    const ingresoData = {
      concepto: formVal.concepto.trim(),
      monto: Number(formVal.monto),
      fecha: formVal.fecha,
      fuente: formVal.fuente,
      cuentaDestino: formVal.cuentaDestino,
    };

    if (this.modoEdicion() && this.ingresoEditandoId()) {
      this.incomeSvc.actualizarIngreso(this.ingresoEditandoId()!, ingresoData);
    } else {
      this.incomeSvc.agregarIngreso(ingresoData);
    }

    this.cerrarModal();
  }
}
