import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { BudgetService } from './budget.service';
import { ExpenseService } from './expense.service';

describe('BudgetService', () => {
  let budgetSvc: BudgetService;
  let expenseSvc: ExpenseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BudgetService, ExpenseService],
    });
    budgetSvc = TestBed.inject(BudgetService);
    expenseSvc = TestBed.inject(ExpenseService);
    expenseSvc.limpiarGastos();
    budgetSvc.resetearLimites();
  });

  it('should initialize with default preloaded budgets and 0% consumption when no expenses exist', async () => {
    const list = await firstValueFrom(budgetSvc.presupuestosConProgreso$);
    expect(list.length).toBeGreaterThan(0);

    const alimentacion = list.find((p) => p.categoria === 'Alimentación');
    expect(alimentacion).toBeTruthy();
    expect(alimentacion?.montoEjecutado).toBe(0);
    expect(alimentacion?.porcentajeConsumo).toBe(0);
    expect(alimentacion?.estadoColor).toBe('cyan');
  });

  it('should calculate consumption and shift warning color to amber (70-89%) and rose (>=90%)', async () => {
    // Presupuesto por defecto de Transporte es Q 1,200
    // Agregar gasto de Q 900 (75% -> amber)
    expenseSvc.agregarGasto({
      concepto: 'Gasolina Quincenal',
      monto: 900,
      fecha: '2026-08-05',
      categoria: 'Transporte',
      metodoPago: 'Tarjeta de Débito',
    });

    let list = await firstValueFrom(budgetSvc.presupuestosConProgreso$);
    let transporte = list.find((p) => p.categoria === 'Transporte');
    expect(transporte?.montoEjecutado).toBe(900);
    expect(transporte?.porcentajeConsumo).toBe(75);
    expect(transporte?.estadoColor).toBe('amber');
    expect(transporte?.desbordado).toBe(false);

    // Agregar gasto adicional de Q 250 (Total 1150 / 1200 = 95.8% -> rose)
    expenseSvc.agregarGasto({
      concepto: 'Peajes y Parqueo',
      monto: 250,
      fecha: '2026-08-10',
      categoria: 'Transporte',
      metodoPago: 'Efectivo',
    });

    list = await firstValueFrom(budgetSvc.presupuestosConProgreso$);
    transporte = list.find((p) => p.categoria === 'Transporte');
    expect(transporte?.montoEjecutado).toBe(1150);
    expect(transporte?.porcentajeConsumo).toBe(96);
    expect(transporte?.estadoColor).toBe('rose');
    expect(transporte?.desbordado).toBe(false);

    // Agregar gasto que causa desborde (> 1200)
    expenseSvc.agregarGasto({
      concepto: 'Reparación de Llanta',
      monto: 100,
      fecha: '2026-08-12',
      categoria: 'Transporte',
      metodoPago: 'Efectivo',
    });

    list = await firstValueFrom(budgetSvc.presupuestosConProgreso$);
    transporte = list.find((p) => p.categoria === 'Transporte');
    expect(transporte?.montoEjecutado).toBe(1250);
    expect(transporte?.desbordado).toBe(true);
  });

  it('should update budget limit reactively', async () => {
    const list = await firstValueFrom(budgetSvc.presupuestos$);
    const primerId = list[0].id;

    budgetSvc.actualizarLimite(primerId, 4500);

    const updated = await firstValueFrom(budgetSvc.presupuestos$);
    const modificado = updated.find((p) => p.id === primerId);
    expect(modificado?.montoLimite).toBe(4500);
  });
});
