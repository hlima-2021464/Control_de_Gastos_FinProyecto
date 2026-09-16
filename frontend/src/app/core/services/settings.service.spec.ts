import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SettingsService, SETTINGS_POR_DEFECTO } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('debe inicializarse con los valores predeterminados de fábrica', () => {
    expect(service).toBeTruthy();
    expect(service.snapshot.moneda.codigo).toBe('GTQ');
    expect(service.snapshot.moneda.simbolo).toBe('Q');
    expect(service.snapshot.tiempoInactividadMin).toBe(15);
    expect(service.snapshot.diaInicioCiclo).toBe(1);
    expect(service.snapshot.formatoFecha).toBe('DD/MM/YYYY');
  });

  it('debe actualizar la divisa y emitir el nuevo símbolo reactivamente', async () => {
    service.actualizarMoneda('USD');
    expect(service.snapshot.moneda.codigo).toBe('USD');
    expect(service.snapshot.moneda.simbolo).toBe('$');

    const simbolo = await firstValueFrom(service.simboloMoneda$);
    expect(simbolo).toBe('$');
  });


  it('debe actualizar el día de corte del ciclo financiero y el formato de fecha', () => {
    service.actualizarDiaInicioCiclo(15);
    expect(service.snapshot.diaInicioCiclo).toBe(15);

    service.actualizarFormatoFecha('YYYY-MM-DD');
    expect(service.snapshot.formatoFecha).toBe('YYYY-MM-DD');
  });

  it('debe actualizar las reglas de notificación y el perfil visual', () => {
    service.actualizarReglasNotificaciones({ alertaDesborde100: false });
    expect(service.snapshot.notificaciones.alertaDesborde100).toBe(false);
    expect(service.snapshot.notificaciones.visualesActivas).toBe(true);

    service.actualizarPerfilVisual({ nombreVisualizacion: 'Administrador Principal', tipoAvatar: 'iniciales' });
    expect(service.snapshot.perfilVisual.nombreVisualizacion).toBe('Administrador Principal');
    expect(service.snapshot.perfilVisual.tipoAvatar).toBe('iniciales');
  });

  it('debe restablecer los ajustes a los valores de fábrica', () => {
    service.actualizarMoneda('EUR');
    service.actualizarTiempoInactividad(30);
    expect(service.snapshot.moneda.codigo).toBe('EUR');

    service.restablecerAjustesPredeterminados();
    expect(service.snapshot.moneda.codigo).toBe('GTQ');
    expect(service.snapshot.tiempoInactividadMin).toBe(15);
  });
});
