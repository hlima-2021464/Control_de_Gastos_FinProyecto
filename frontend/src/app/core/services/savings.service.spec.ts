import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SavingsService } from './savings.service';

describe('SavingsService', () => {
  let service: SavingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SavingsService],
    });
    service = TestBed.inject(SavingsService);
    service.limpiarMetas();
  });

  it('should initialize with baseline in zero ($Q 0.00)', async () => {
    const total = await firstValueFrom(service.totalAhorrado$);
    const cumplimiento = await firstValueFrom(service.porcentajeCumplimientoGlobal$);
    expect(total).toBe(0);
    expect(cumplimiento).toBe(0);
    expect(service.snapshot.length).toBe(0);
  });

  it('should add savings goal and record direct deposits reactively', async () => {
    const meta = service.agregarMeta({
      titulo: 'Fondo de Emergencia',
      montoObjetivo: 10000,
      montoActual: 2000,
      fechaLimite: '2026-12-31',
    });

    let total = await firstValueFrom(service.totalAhorrado$);
    let cumplimiento = await firstValueFrom(service.porcentajeCumplimientoGlobal$);
    expect(total).toBe(2000);
    expect(cumplimiento).toBe(20);

    // Abono directo de Q 3,000
    service.abonarAMeta(meta.id, 3000);

    total = await firstValueFrom(service.totalAhorrado$);
    cumplimiento = await firstValueFrom(service.porcentajeCumplimientoGlobal$);
    expect(total).toBe(5000);
    expect(cumplimiento).toBe(50);
  });

  it('should delete goal and recalculate totals', async () => {
    const meta = service.agregarMeta({
      titulo: 'Vacaciones Fin de Año',
      montoObjetivo: 5000,
      montoActual: 1500,
      fechaLimite: '2026-11-30',
    });

    expect(service.snapshot.length).toBe(1);
    service.eliminarMeta(meta.id);
    expect(service.snapshot.length).toBe(0);

    const total = await firstValueFrom(service.totalAhorrado$);
    expect(total).toBe(0);
  });
});
