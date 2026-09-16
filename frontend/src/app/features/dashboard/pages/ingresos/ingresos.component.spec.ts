import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IngresosComponent } from './ingresos.component';
import { IncomeService } from '../../../../core/services/income.service';

describe('IngresosComponent', () => {
  let component: IngresosComponent;
  let incomeService: IncomeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngresosComponent],
      providers: [provideHttpClient(), provideRouter([]), IncomeService],
    }).compileComponents();

    incomeService = TestBed.inject(IncomeService);
    incomeService.limpiarIngresos();
    const fixture = TestBed.createComponent(IngresosComponent);
    component = fixture.componentInstance;
  });

  it('should create the IngresosComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty filtered list and zero totals', async () => {
    const lista = await firstValueFrom(component.listaIngresosFiltrada$);
    expect(lista.length).toBe(0);
  });

  it('should open modal for registering a new income', () => {
    component.abrirModalRegistro();
    expect(component.mostrarModal()).toBe(true);
    expect(component.modoEdicion()).toBe(false);
  });

  it('should filter incomes by text reactively', async () => {
    incomeService.agregarIngreso({
      concepto: 'Pago Freelance Web',
      monto: 3000,
      fecha: '2026-08-14',
      fuente: 'Desarrollo Web',
    });

    incomeService.agregarIngreso({
      concepto: 'Nómina Empresa',
      monto: 4000,
      fecha: '2026-08-15',
      fuente: 'Nómina Fija',
    });

    component.filtroTexto = 'Freelance';
    component.actualizarFiltros();

    const lista = await firstValueFrom(component.listaIngresosFiltrada$);
    expect(lista.length).toBe(1);
    expect(lista[0].concepto).toBe('Pago Freelance Web');
  });
});
