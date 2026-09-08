import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { BudgetService, BudgetProgress } from '../../../../core/services/budget.service';
import { CategoryService, CategoryItem } from '../../../../core/services/category.service';

@Component({
  selector: 'app-presupuestos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './presupuestos.component.html',
  styleUrls: ['./presupuestos.component.css'],
})
export class PresupuestosComponent {
  private readonly budgetSvc = inject(BudgetService);
  private readonly categorySvc = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  readonly presupuestos$: Observable<BudgetProgress[]> = this.budgetSvc.presupuestosConProgreso$;
  readonly totalPresupuestado$: Observable<number> = this.budgetSvc.totalPresupuestado$;
  readonly totalEjecutado$: Observable<number> = this.budgetSvc.totalEjecutado$;
  readonly categoriasGasto$: Observable<CategoryItem[]> = this.categorySvc.categoriasGasto$;

  // ─── Modal de Ajuste de Límite / Nuevo Presupuesto ───────────
  readonly mostrarModal = signal<boolean>(false);
  readonly modoEdicion = signal<boolean>(false);
  readonly presupuestoEditandoId = signal<string | null>(null);

  readonly presupuestoForm: FormGroup = this.fb.group({
    categoria: ['', [Validators.required]],
    montoLimite: [null, [Validators.required, Validators.min(1)]],
    periodo: ['Mensual', [Validators.required]],
  });

  abrirModalNuevo(): void {
    this.modoEdicion.set(false);
    this.presupuestoEditandoId.set(null);
    this.presupuestoForm.reset({
      categoria: 'Alimentación',
      montoLimite: null,
      periodo: 'Mensual',
    });
    this.mostrarModal.set(true);
  }

  abrirModalEditar(item: BudgetProgress): void {
    this.modoEdicion.set(true);
    this.presupuestoEditandoId.set(item.id);
    this.presupuestoForm.patchValue({
      categoria: item.categoria,
      montoLimite: item.montoLimite,
      periodo: item.periodo,
    });
    this.mostrarModal.set(true);
  }

  eliminarPresupuesto(id: string): void {
    if (confirm('¿Desea retirar el límite presupuestario para este rubro?')) {
      this.budgetSvc.eliminarPresupuesto(id);
    }
  }

  resetearValoresPorDefecto(): void {
    if (confirm('¿Desea restaurar los topes presupuestarios a los valores recomendados por defecto?')) {
      this.budgetSvc.resetearLimites();
    }
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.modoEdicion.set(false);
    this.presupuestoEditandoId.set(null);
    this.presupuestoForm.reset();
  }

  guardarPresupuesto(): void {
    if (this.presupuestoForm.invalid) {
      this.presupuestoForm.markAllAsTouched();
      return;
    }

    const formVal = this.presupuestoForm.value;
    const limiteNum = Number(formVal.montoLimite);

    if (this.modoEdicion() && this.presupuestoEditandoId()) {
      this.budgetSvc.actualizarLimite(this.presupuestoEditandoId()!, limiteNum);
    } else {
      this.budgetSvc.agregarPresupuesto({
        categoria: formVal.categoria,
        montoLimite: limiteNum,
        periodo: formVal.periodo,
      });
    }

    this.cerrarModal();
  }
}
