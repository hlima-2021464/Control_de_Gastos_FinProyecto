import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { IncomeService } from './income.service';

describe('IncomeService', () => {
  let service: IncomeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IncomeService],
    });
    service = TestBed.inject(IncomeService);
    service.limpiarIngresos();
  });

  it('should start with zero baseline ($Q 0.00) and empty list', async () => {
    const total = await firstValueFrom(service.totalIngresos$);
    expect(total).toBe(0);
    expect(service.snapshot.length).toBe(0);
  });

  it('should add income and recalculate totalIngresos reactively', async () => {
    service.agregarIngreso({
      concepto: 'Desarrollo Web Frontend',
      monto: 5000,
      fecha: '2026-08-10',
      fuente: 'Desarrollo Web',
    });

    const total = await firstValueFrom(service.totalIngresos$);
    expect(total).toBe(5000);
  });

  it('should calculate category totals accurately', async () => {
    service.agregarIngreso({
      concepto: 'Nómina Quincenal',
      monto: 4000,
      fecha: '2026-08-05',
      fuente: 'Nómina Fija',
    });

    service.agregarIngreso({
      concepto: 'Consultoría Cloud',
      monto: 2500,
      fecha: '2026-08-20',
      fuente: 'Consultoría',
    });

    const nomina = await firstValueFrom(service.totalNomina$);
    const consultoria = await firstValueFrom(service.totalConsultoria$);
    expect(nomina).toBe(4000);
    expect(consultoria).toBe(2500);
  });

  it('should delete income and update state reactively', async () => {
    const item = service.agregarIngreso({
      concepto: 'Abono Temporal',
      monto: 1200,
      fecha: '2026-08-12',
      fuente: 'Nómina Fija',
    });

    expect(service.snapshot.length).toBe(1);
    service.eliminarIngreso(item.id);
    expect(service.snapshot.length).toBe(0);

    const total = await firstValueFrom(service.totalIngresos$);
    expect(total).toBe(0);
  });
});
