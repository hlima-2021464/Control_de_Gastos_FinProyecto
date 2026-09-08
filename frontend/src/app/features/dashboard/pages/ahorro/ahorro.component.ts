import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { SavingsService, SavingGoal } from '../../../../core/services/savings.service';

@Component({
  selector: 'app-ahorro',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ahorro.component.html',
  styleUrls: ['./ahorro.component.css'],
})
export class AhorroComponent {
  private readonly savingsSvc = inject(SavingsService);
  private readonly fb = inject(FormBuilder);

  readonly metas$: Observable<SavingGoal[]> = this.savingsSvc.metas$;
  readonly totalAhorrado$: Observable<number> = this.savingsSvc.totalAhorrado$;
  readonly totalObjetivo$: Observable<number> = this.savingsSvc.totalObjetivo$;
  readonly porcentajeCumplimientoGlobal$: Observable<number> = this.savingsSvc.porcentajeCumplimientoGlobal$;

  // ─── Modal Meta (Crear / Editar) ─────────────────────────────
  readonly mostrarModalMeta = signal<boolean>(false);
  readonly modoEdicion = signal<boolean>(false);
  readonly metaEditandoId = signal<string | null>(null);

  readonly metaForm: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    montoObjetivo: [null, [Validators.required, Validators.min(10)]],
    montoActual: [0, [Validators.min(0)]],
    fechaLimite: [new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0], [Validators.required]],
    colorHex: ['#10b981', [Validators.required]],
  });

  // ─── Modal Abono Directo ─────────────────────────────────────
  readonly mostrarModalAbono = signal<boolean>(false);
  readonly metaParaAbono = signal<SavingGoal | null>(null);
  readonly abonoForm: FormGroup = this.fb.group({
    montoAbono: [null, [Validators.required, Validators.min(0.01)]],
  });

  abrirModalNuevaMeta(): void {
    this.modoEdicion.set(false);
    this.metaEditandoId.set(null);
    this.metaForm.reset({
      titulo: '',
      montoObjetivo: null,
      montoActual: 0,
      fechaLimite: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
      colorHex: '#10b981',
    });
    this.mostrarModalMeta.set(true);
  }

  abrirModalEditar(item: SavingGoal): void {
    this.modoEdicion.set(true);
    this.metaEditandoId.set(item.id);
    this.metaForm.patchValue({
      titulo: item.titulo,
      montoObjetivo: item.montoObjetivo,
      montoActual: item.montoActual,
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

    if (this.modoEdicion() && this.metaEditandoId()) {
      this.savingsSvc.actualizarMeta(this.metaEditandoId()!, {
        titulo: formVal.titulo.trim(),
        montoObjetivo: Number(formVal.montoObjetivo),
        montoActual: Number(formVal.montoActual),
        fechaLimite: formVal.fechaLimite,
        colorHex: formVal.colorHex,
      });
    } else {
      this.savingsSvc.agregarMeta({
        titulo: formVal.titulo.trim(),
        montoObjetivo: Number(formVal.montoObjetivo),
        montoActual: Number(formVal.montoActual) || 0,
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

    const monto = Number(this.abonoForm.value.montoAbono);
    this.savingsSvc.abonarAMeta(this.metaParaAbono()!.id, monto);
    this.cerrarModalAbono();
  }

  calcularPorcentaje(actual: number, objetivo: number): number {
    if (objetivo <= 0) return 0;
    return Math.min(100, Math.round((actual / objetivo) * 100));
  }
}
