import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';
import { IncomeService } from '../../../../core/services/income.service';
import { ExpenseService } from '../../../../core/services/expense.service';
import { BudgetService } from '../../../../core/services/budget.service';
import { CategoryService } from '../../../../core/services/category.service';
import { SavingsService } from '../../../../core/services/savings.service';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.css'],
})
export class ConfiguracionComponent {
  private readonly authSvc = inject(AuthService);
  private readonly incomeSvc = inject(IncomeService);
  private readonly expenseSvc = inject(ExpenseService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly categorySvc = inject(CategoryService);
  private readonly savingsSvc = inject(SavingsService);

  readonly currentUser = this.authSvc.currentUser;
  readonly mostrarModalReset = signal<boolean>(false);
  readonly mensajeExito = signal<string | null>(null);

  get userDisplayName(): string {
    const user = this.currentUser();
    return user?.name || user?.username || user?.email || 'Usuario';
  }

  get userEmail(): string {
    const user = this.currentUser();
    return user?.email || 'No especificado';
  }

  get userRole(): string {
    const user = this.currentUser();
    return user?.role === 'ADMIN' ? 'Administrador del Sistema' : 'Usuario Personal';
  }

  get userAvatarUrl(): string | null {
    const user = this.currentUser();
    return user?.picture || user?.avatarUrl || null;
  }

  get userInitial(): string {
    const name = this.userDisplayName;
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : 'U';
  }

  get esGoogleOAuth(): boolean {
    const user = this.currentUser();
    return !!(user?.picture || user?.avatarUrl);
  }

  abrirModalReset(): void {
    this.mostrarModalReset.set(true);
  }

  cerrarModalReset(): void {
    this.mostrarModalReset.set(false);
  }

  confirmarRestablecer(): void {
    this.incomeSvc.limpiarIngresos();
    this.expenseSvc.limpiarGastos();
    this.budgetSvc.resetearLimites();
    this.categorySvc.restablecerCategorias();
    this.savingsSvc.limpiarMetas();

    this.mostrarModalReset.set(false);
    this.mostrarNotificacionTemporal('Los datos han sido restablecidos a la línea base en cero exitosamente.');
  }

  exportarRespaldoJSON(): void {
    const respaldo = {
      version: '1.0.0',
      fechaExportacion: new Date().toISOString(),
      usuario: {
        nombre: this.userDisplayName,
        email: this.userEmail,
        rol: this.userRole,
      },
      datos: {
        ingresos: this.incomeSvc.snapshot,
        gastos: this.expenseSvc.snapshot,
        presupuestos: this.budgetSvc.snapshot,
        categorias: this.categorySvc.snapshot,
        ahorros: this.savingsSvc.snapshot,
      },
    };

    const contenidoJSON = JSON.stringify(respaldo, null, 2);
    const blob = new Blob([contenidoJSON], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_control_gastos_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.mostrarNotificacionTemporal('El archivo de respaldo en formato JSON ha sido generado y descargado correctamente.');
  }

  private mostrarNotificacionTemporal(msg: string): void {
    this.mensajeExito.set(msg);
    setTimeout(() => {
      this.mensajeExito.set(null);
    }, 5000);
  }
}
