import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { SavingsService, SavingGoal } from '../../../../core/services/savings.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { obtenerFechaHoyISO, fechaNoFuturaValidator } from '../../../../core/utils/date.utils';
import { CurrencyConversionPipe } from '../../../../core/pipes/currency-conversion.pipe';

@Component({
  selector: 'app-ahorro',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyConversionPipe],
  templateUrl: './ahorro.component.html',
  styleUrls: ['./ahorro.component.css'],
})
export class AhorroComponent {
  private readonly savingsSvc = inject(SavingsService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly fb = inject(FormBuilder);

  readonly fechaHoyISO = obtenerFechaHoyISO();
  readonly metas$: Observable<SavingGoal[]> = this.savingsSvc.metas$;
  readonly totalAhorrado$: Observable<number> = this.savingsSvc.totalAhorrado$;
  readonly totalObjetivo$: Observable<number> = this.savingsSvc.totalObjetivo$;
  readonly porcentajeCumplimientoGlobal$: Observable<number> = this.savingsSvc.porcentajeCumplimientoGlobal$;
  readonly simboloMoneda$: Observable<string> = this.settingsSvc.simboloMoneda$;

  // ─── Modal Meta (Crear / Editar) ─────────────────────────────
  readonly mostrarModalMeta = signal<boolean>(false);
  readonly modoEdicion = signal<boolean>(false);
  readonly metaEditandoId = signal<string | null>(null);

  readonly metaForm: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    montoObjetivo: [null, [Validators.required, Validators.min(1)]],
    montoActual: [0, [Validators.min(0)]],
    fechaLimite: [this.fechaHoyISO, [Validators.required, fechaNoFuturaValidator]],
    colorHex: ['#10b981', [Validators.required]],
  });

  // ─── Modal Abono Directo ─────────────────────────────────────
  readonly mostrarModalAbono = signal<boolean>(false);
  readonly metaParaAbono = signal<SavingGoal | null>(null);
  readonly abonoForm: FormGroup = this.fb.group({
    montoAbono: [null, [Validators.required, Validators.min(0.01)]],
  });

  // ─── Modal Retiro de Fondos ──────────────────────────────────
  readonly mostrarModalRetiro = signal<boolean>(false);
  readonly metaParaRetiro = signal<SavingGoal | null>(null);
  readonly errorRetiro = signal<string | null>(null);
  readonly retiroForm: FormGroup = this.fb.group({
    montoRetiro: [null, [Validators.required, Validators.min(0.01)]],
  });

  abrirModalNuevaMeta(): void {
    this.modoEdicion.set(false);
    this.metaEditandoId.set(null);
    this.metaForm.reset({
      titulo: '',
      montoObjetivo: null,
      montoActual: 0,
      fechaLimite: this.fechaHoyISO,
      colorHex: '#10b981',
    });
    this.mostrarModalMeta.set(true);
  }

  abrirModalEditar(item: SavingGoal): void {
    this.modoEdicion.set(true);
    this.metaEditandoId.set(item.id);

    const montoObjetivoConvertido = Number(this.settingsSvc.convertirDesdeGTQ(item.montoObjetivo).toFixed(2));
    const montoActualConvertido = Number(this.settingsSvc.convertirDesdeGTQ(item.montoActual).toFixed(2));

    this.metaForm.patchValue({
      titulo: item.titulo,
      montoObjetivo: montoObjetivoConvertido,
      montoActual: montoActualConvertido,
      fechaLimite: item.fechaLimite,
      colorHex: item.colorHex || '#10b981',
    });
    this.mostrarModalMeta.set(true);
  }

  abrirModalAbono(item: SavingGoal): void {
    this.metaParaAbono.set(item);
    this.abonoForm.reset({
      montoAbono: null,
    });
    this.mostrarModalAbono.set(true);
  }

  abrirModalRetiro(item: SavingGoal): void {
    this.metaParaRetiro.set(item);
    this.errorRetiro.set(null);
    this.retiroForm.reset({
      montoRetiro: null,
    });
    this.mostrarModalRetiro.set(true);
  }

  cerrarModalMeta(): void {
    this.mostrarModalMeta.set(false);
    this.modoEdicion.set(false);
    this.metaEditandoId.set(null);
    this.metaForm.reset();
  }

  cerrarModalAbono(): void {
    this.mostrarModalAbono.set(false);
    this.metaParaAbono.set(null);
    this.abonoForm.reset();
  }

  cerrarModalRetiro(): void {
    this.mostrarModalRetiro.set(false);
    this.metaParaRetiro.set(null);
    this.errorRetiro.set(null);
    this.retiroForm.reset();
  }

  eliminarMeta(id: string): void {
    if (confirm('¿Desea dar de baja esta meta de ahorro?')) {
      this.savingsSvc.eliminarMeta(id);
    }
  }

  guardarMeta(): void {
    if (this.metaForm.invalid) {
      this.metaForm.markAllAsTouched();
      return;
    }

    const formVal = this.metaForm.value;
    const montoObjetivoBase = Number(this.settingsSvc.convertirHaciaGTQ(Number(formVal.montoObjetivo)).toFixed(2));
    const montoActualBase = Number(this.settingsSvc.convertirHaciaGTQ(Number(formVal.montoActual) || 0).toFixed(2));

    if (this.modoEdicion() && this.metaEditandoId()) {
      this.savingsSvc.actualizarMeta(this.metaEditandoId()!, {
        titulo: formVal.titulo.trim(),
        montoObjetivo: montoObjetivoBase,
        montoActual: montoActualBase,
        fechaLimite: formVal.fechaLimite,
        colorHex: formVal.colorHex,
      });
    } else {
      this.savingsSvc.agregarMeta({
        titulo: formVal.titulo.trim(),
        montoObjetivo: montoObjetivoBase,
        montoActual: montoActualBase,
        fechaLimite: formVal.fechaLimite,
        colorHex: formVal.colorHex,
      });
    }

    this.cerrarModalMeta();
  }

  confirmarAbono(): void {
    if (this.abonoForm.invalid || !this.metaParaAbono()) {
      this.abonoForm.markAllAsTouched();
      return;
    }

    const montoIngresado = Number(this.abonoForm.value.montoAbono);
    const montoBase = Number(this.settingsSvc.convertirHaciaGTQ(montoIngresado).toFixed(2));

    this.savingsSvc.abonarAMeta(this.metaParaAbono()!.id, montoBase);
    this.cerrarModalAbono();
  }

  confirmarRetiro(): void {
    this.errorRetiro.set(null);
    const meta = this.metaParaRetiro();
    if (!meta) return;

    if (this.retiroForm.invalid) {
      this.retiroForm.markAllAsTouched();
      return;
    }

    const montoIngresado = Number(this.retiroForm.value.montoRetiro);
    const montoActualEnDivisa = this.settingsSvc.convertirDesdeGTQ(meta.montoActual);

    if (montoIngresado > montoActualEnDivisa) {
      this.errorRetiro.set('El monto a debitar no puede ser superior al capital acumulado en esta meta.');
      return;
    }

    const montoBase = Number(this.settingsSvc.convertirHaciaGTQ(montoIngresado).toFixed(2));
    const exito = this.savingsSvc.retirarDeMeta(meta.id, montoBase);

    if (exito) {
      this.cerrarModalRetiro();
    } else {
      this.errorRetiro.set('No se pudo procesar el retiro. Verifique los fondos disponibles en la meta.');
    }
  }

  calcularPorcentaje(actual: number, objetivo: number): number {
    if (objetivo <= 0) return 0;
    return Math.min(100, Math.round((actual / objetivo) * 100));
  }

  calcularCircunferencia(radio: number = 32): number {
    return 2 * Math.PI * radio;
  }

  calcularDashOffset(actual: number, objetivo: number, radio: number = 32): number {
    const circunf = this.calcularCircunferencia(radio);
    const porcentaje = this.calcularPorcentaje(actual, objetivo);
    return circunf - (porcentaje / 100) * circunf;
  }
}
