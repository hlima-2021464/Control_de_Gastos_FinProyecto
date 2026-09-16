import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  let service: ExpenseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExpenseService],
    });
    service = TestBed.inject(ExpenseService);
    service.limpiarGastos();
  });

  it('should start with zero baseline ($Q 0.00) and empty list', async () => {
    const total = await firstValueFrom(service.totalGastos$);
    expect(total).toBe(0);
    expect(service.snapshot.length).toBe(0);
  });

  it('should add expense and recalculate totalGastos and promedioDiario reactively', async () => {
    service.agregarGasto({
      concepto: 'Supermercado Mensual',
      monto: 1500,
      fecha: '2026-08-10',
      categoria: 'Alimentación',
      metodoPago: 'Tarjeta de Débito',
    });

    const total = await firstValueFrom(service.totalGastos$);
    const promedio = await firstValueFrom(service.promedioDiario$);
    expect(total).toBe(1500);
    expect(promedio).toBe(50); // 1500 / 30
  });

  it('should calculate category breakdown and percentages accurately', async () => {
    service.agregarGasto({
      concepto: 'Gasolina',
      monto: 300,
      fecha: '2026-08-04',
      categoria: 'Transporte',
      metodoPago: 'Tarjeta de Crédito',
    });

    service.agregarGasto({
      concepto: 'Restaurante',
      monto: 700,
      fecha: '2026-08-08',
      categoria: 'Alimentación',
      metodoPago: 'Tarjeta de Débito',
    });

    const categorias = await firstValueFrom(service.gastosPorCategoria$);
    expect(categorias.length).toBe(2);

    const alimentacion = categorias.find((c) => c.categoria === 'Alimentación');
    const transporte = categorias.find((c) => c.categoria === 'Transporte');

    expect(alimentacion?.total).toBe(700);
    expect(alimentacion?.porcentaje).toBe(70);
    expect(transporte?.total).toBe(300);
    expect(transporte?.porcentaje).toBe(30);

    const mayor = await firstValueFrom(service.categoriaMayorConsumo$);
    expect(mayor?.categoria).toBe('Alimentación');
    expect(mayor?.total).toBe(700);
  });

  it('should delete expense and restore state reactively', async () => {
    const item = service.agregarGasto({
      concepto: 'Mantenimiento Vehículo',
      monto: 850,
      fecha: '2026-08-15',
      categoria: 'Transporte',
      metodoPago: 'Transferencia',
    });

    expect(service.snapshot.length).toBe(1);
    service.eliminarGasto(item.id);
    expect(service.snapshot.length).toBe(0);

    const total = await firstValueFrom(service.totalGastos$);
    expect(total).toBe(0);
  });
});
