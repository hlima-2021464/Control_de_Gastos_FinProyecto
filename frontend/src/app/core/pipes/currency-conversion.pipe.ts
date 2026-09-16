import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../services/settings.service';

/**
 * Pipe que convierte dinámicamente un valor monetario base (GTQ)
 * a la divisa activa en el sistema (GTQ, USD, EUR) según las tasas de cambio:
 * 1 USD = 7.80 GTQ
 * 1 EUR = 8.50 GTQ
 */
@Pipe({
  name: 'appMoneda',
  standalone: true,
  pure: false,
})
export class CurrencyConversionPipe implements PipeTransform {
  private readonly settingsSvc = inject(SettingsService);

  transform(montoGTQ: number | null | undefined): number {
    if (montoGTQ === null || montoGTQ === undefined || isNaN(Number(montoGTQ))) {
      return 0;
    }
    return this.settingsSvc.convertirDesdeGTQ(Number(montoGTQ));
  }
}
