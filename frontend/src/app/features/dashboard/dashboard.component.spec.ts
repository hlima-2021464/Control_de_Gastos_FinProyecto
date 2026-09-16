import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { IncomeService } from '../../core/services/income.service';
import { ExpenseService } from '../../core/services/expense.service';
import { BudgetService } from '../../core/services/budget.service';
import { SavingsService } from '../../core/services/savings.service';

describe('DashboardComponent', () => {
  let incomeService: IncomeService;
  let expenseService: ExpenseService;
  let savingsService: SavingsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        IncomeService,
        ExpenseService,
        BudgetService,
        SavingsService,
      ],
    }).compileComponents();

    incomeService = TestBed.inject(IncomeService);
    expenseService = TestBed.inject(ExpenseService);
    savingsService = TestBed.inject(SavingsService);
  });

  it('should create the dashboard component', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should update active period on setPeriod', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.setPeriod('Semana');
    expect(component.activePeriod()).toBe('Semana');
  });

  it('should start with zero baseline and sync incomes, expenses, savings and balance reactively', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;

    incomeService.limpiarIngresos();
    expenseService.limpiarGastos();
    savingsService.limpiarMetas();

    const initialTotal = await firstValueFrom(component.totalIngresos$);
    const initialGastos = await firstValueFrom(component.totalGastos$);
    const initialAhorro = await firstValueFrom(component.totalAhorrado$);
    const initialBalance = await firstValueFrom(component.balanceTotal$);

    expect(initialTotal).toBe(0);
    expect(initialGastos).toBe(0);
    expect(initialAhorro).toBe(0);
    expect(initialBalance).toBe(0);

    const fechaHoy = new Date().toISOString().split('T')[0];

    // Agregar ingreso de Q 5,000
    incomeService.agregarIngreso({
      concepto: 'Abono Quincenal',
      monto: 5000,
      fecha: fechaHoy,
      fuente: 'Nómina Fija',
    });

    // Agregar gasto de Q 1,200
    expenseService.agregarGasto({
      concepto: 'Pago de Servicios',
      monto: 1200,
      fecha: fechaHoy,
      categoria: 'Servicios',
      metodoPago: 'Transferencia',
    });

    const updatedTotal = await firstValueFrom(component.totalIngresos$);
    const updatedGastos = await firstValueFrom(component.totalGastos$);
    const updatedBalance = await firstValueFrom(component.balanceTotal$);

    expect(updatedTotal).toBe(5000);
    expect(updatedGastos).toBe(1200);
    expect(updatedBalance).toBe(3800); // 5000 - 1200 - 0 = 3800

    // Agregar meta de ahorro con abono de Q 800
    const meta = savingsService.agregarMeta({
      titulo: 'Meta Auto',
      montoObjetivo: 10000,
      montoActual: 800,
      fechaLimite: fechaHoy,
    });

    const balanceConAhorro = await firstValueFrom(component.balanceTotal$);
    const ahorroAcumulado = await firstValueFrom(component.totalAhorrado$);

    expect(ahorroAcumulado).toBe(800);
    expect(balanceConAhorro).toBe(3000); // 5000 - 1200 - 800 = 3000

    // Retiro de ahorro de Q 300 (retorna a balance disponible)
    savingsService.retirarDeMeta(meta.id, 300);
    const balancePostRetiro = await firstValueFrom(component.balanceTotal$);
    const ahorroPostRetiro = await firstValueFrom(component.totalAhorrado$);

    expect(ahorroPostRetiro).toBe(500);
    expect(balancePostRetiro).toBe(3300); // 5000 - 1200 - 500 = 3300
  });
});
