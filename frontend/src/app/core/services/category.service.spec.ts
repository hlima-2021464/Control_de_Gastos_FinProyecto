import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CategoryService } from './category.service';
import { ExpenseService } from './expense.service';
import { IncomeService } from './income.service';

describe('CategoryService', () => {
  let categorySvc: CategoryService;
  let expenseSvc: ExpenseService;
  let incomeSvc: IncomeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CategoryService, ExpenseService, IncomeService],
    });
    categorySvc = TestBed.inject(CategoryService);
    expenseSvc = TestBed.inject(ExpenseService);
    incomeSvc = TestBed.inject(IncomeService);

    expenseSvc.limpiarGastos();
    incomeSvc.limpiarIngresos();
    categorySvc.restablecerCategorias();
  });

  it('should load default categories correctly', async () => {
    const list = await firstValueFrom(categorySvc.categorias$);
    expect(list.length).toBeGreaterThanOrEqual(9);

    const gastos = await firstValueFrom(categorySvc.categoriasGasto$);
    const ingresos = await firstValueFrom(categorySvc.categoriasIngreso$);
    expect(gastos.length).toBe(6);
    expect(ingresos.length).toBe(3);
  });

  it('should add new custom category and persist it', async () => {
    categorySvc.agregarCategoria({
      nombre: 'Inversiones Cripto',
      tipo: 'INGRESO',
      colorHex: '#10b981',
      icono: 'chart',
    });

    const ingresos = await firstValueFrom(categorySvc.categoriasIngreso$);
    const agregada = ingresos.find((c) => c.nombre === 'Inversiones Cripto');
    expect(agregada).toBeTruthy();
  });

  it('should prevent deleting category that has active transactions', () => {
    expenseSvc.agregarGasto({
      concepto: 'Cena Restaurante',
      monto: 350,
      fecha: '2026-08-01',
      categoria: 'Alimentación',
      metodoPago: 'Tarjeta de Débito',
    });

    const catAlimentacion = categorySvc.snapshot.find((c) => c.nombre === 'Alimentación')!;
    const intentoEliminar = categorySvc.eliminarCategoria(catAlimentacion.id);

    expect(intentoEliminar.exitoso).toBe(false);
    expect(intentoEliminar.motivo).toContain('transacciones financieras activas');
    expect(categorySvc.snapshot.some((c) => c.id === catAlimentacion.id)).toBe(true);
  });

  it('should allow deleting an unused category', () => {
    const nueva = categorySvc.agregarCategoria({
      nombre: 'Suscripciones Streaming',
      tipo: 'GASTO',
      colorHex: '#ec4899',
      icono: 'film',
    });

    const resultado = categorySvc.eliminarCategoria(nueva.id);
    expect(resultado.exitoso).toBe(true);
    expect(categorySvc.snapshot.some((c) => c.id === nueva.id)).toBe(false);
  });
});
