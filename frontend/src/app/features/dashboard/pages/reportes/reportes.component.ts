import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IncomeService } from '../../../../core/services/income.service';
import { ExpenseService } from '../../../../core/services/expense.service';
import { SettingsService } from '../../../../core/services/settings.service';

export interface ComparativoPeriodo {
  etiqueta: string;
  subetiqueta: string;
  ingresos: number;
  gastos: number;
  alturaIngresos: number; // Porcentaje de altura para la barra
  alturaGastos: number;   // Porcentaje de altura para la barra
}

export interface MetricasAnaliticas {
  totalIngresos: number;
  totalGastos: number;
  balanceNeto: number;
  tasaAhorro: number;
  flujoCajaTotal: number;
  indiceEficiencia: string;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css'],
})
export class ReportesComponent {
  private readonly incomeSvc = inject(IncomeService);
  private readonly expenseSvc = inject(ExpenseService);
  private readonly settingsSvc = inject(SettingsService);

  readonly simboloMoneda$: Observable<string> = this.settingsSvc.simboloMoneda$;
  readonly periodoSeleccionado = signal<'Semanal' | 'Mensual' | 'Anual'>('Mensual');
  private readonly periodoSubject = new BehaviorSubject<'Semanal' | 'Mensual' | 'Anual'>('Mensual');


  // ─── Transacciones Filtradas según el Período Activo ─────────
  private readonly transaccionesFiltradas$ = combineLatest([
    this.incomeSvc.ingresos$,
    this.expenseSvc.gastos$,
    this.periodoSubject.asObservable(),
  ]).pipe(
    map(([ingresos, gastos, periodo]) => {
      const hoy = new Date();
      const anioActual = hoy.getFullYear();
      const mesActual = hoy.getMonth();

      const filtroFecha = (fechaStr: string): boolean => {
        if (!fechaStr) return false;
        const [anioStr, mesStr, diaStr] = fechaStr.split('-');
        const itemAnio = parseInt(anioStr, 10);
        const itemMes = parseInt(mesStr, 10) - 1;
        const itemDia = parseInt(diaStr, 10);
        const fechaItem = new Date(itemAnio, itemMes, itemDia);

        if (periodo === 'Semanal') {
          const hace7Dias = new Date();
          hace7Dias.setDate(hoy.getDate() - 7);
          hace7Dias.setHours(0, 0, 0, 0);
          return fechaItem >= hace7Dias && fechaItem <= hoy;
        }

        if (periodo === 'Mensual') {
          return itemAnio === anioActual && itemMes === mesActual;
        }

        // Anual
        return itemAnio === anioActual;
      };

      const ingresosFiltrados = ingresos.filter((i) => filtroFecha(i.fecha));
      const gastosFiltrados = gastos.filter((g) => filtroFecha(g.fecha));

      return { ingresosFiltrados, gastosFiltrados, periodo };
    })
  );

  // ─── Métricas Analíticas Consolidadas del Período ────────────
  readonly metricas$: Observable<MetricasAnaliticas> = this.transaccionesFiltradas$.pipe(
    map(({ ingresosFiltrados, gastosFiltrados }) => {
      const ingresos = ingresosFiltrados.reduce((acc, i) => acc + (Number(i.monto) || 0), 0);
      const gastos = gastosFiltrados.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
      const balanceNeto = ingresos - gastos;
      const tasaAhorro = ingresos > 0 ? Math.max(0, Math.round((balanceNeto / ingresos) * 100)) : 0;
      const flujoCajaTotal = balanceNeto;

      let indiceEficiencia = 'Equilibrado';
      if (tasaAhorro >= 30) {
        indiceEficiencia = 'Excelente';
      } else if (tasaAhorro >= 15) {
        indiceEficiencia = 'Saludable';
      } else if (ingresos < gastos) {
        indiceEficiencia = 'Déficit';
      }

      return {
        totalIngresos: ingresos,
        totalGastos: gastos,
        balanceNeto,
        tasaAhorro,
        flujoCajaTotal,
        indiceEficiencia,
      };
    })
  );

  // ─── Barras comparativas reactivas de Ingresos vs Gastos ─────
  readonly barrasComparativas$: Observable<ComparativoPeriodo[]> = this.transaccionesFiltradas$.pipe(
    map(({ ingresosFiltrados, gastosFiltrados, periodo }) => {
      const hoy = new Date();

      if (periodo === 'Semanal') {
        const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dias: { etiqueta: string; subetiqueta: string; fechaKey: string; ingresos: number; gastos: number }[] = [];

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(hoy.getDate() - i);
          const diaNum = d.getDate();
          const mesNum = d.getMonth() + 1;
          const diaNom = diasNombres[d.getDay()];
          const iso = d.toISOString().split('T')[0];
          dias.push({
            etiqueta: diaNom,
            subetiqueta: `${diaNum}/${mesNum}`,
            fechaKey: iso,
            ingresos: 0,
            gastos: 0,
          });
        }

        ingresosFiltrados.forEach((item) => {
          const match = dias.find((d) => d.fechaKey === item.fecha);
          if (match) match.ingresos += Number(item.monto) || 0;
        });

        gastosFiltrados.forEach((item) => {
          const match = dias.find((d) => d.fechaKey === item.fecha);
          if (match) match.gastos += Number(item.monto) || 0;
        });

        const maxVal = Math.max(...dias.map((d) => Math.max(d.ingresos, d.gastos)), 1);

        return dias.map((d) => ({
          etiqueta: d.etiqueta,
          subetiqueta: d.subetiqueta,
          ingresos: d.ingresos,
          gastos: d.gastos,
          alturaIngresos: d.ingresos > 0 ? Math.max(12, Math.round((d.ingresos / maxVal) * 100)) : 0,
          alturaGastos: d.gastos > 0 ? Math.max(12, Math.round((d.gastos / maxVal) * 100)) : 0,
        }));
      }

      if (periodo === 'Anual') {
        const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const meses = nombresMeses.map((nombre, index) => ({
          etiqueta: nombre,
          subetiqueta: `${nombre}`,
          mesIndex: index,
          ingresos: 0,
          gastos: 0,
        }));

        ingresosFiltrados.forEach((item) => {
          const mesItem = item.fecha ? parseInt(item.fecha.split('-')[1] || '1', 10) - 1 : 0;
          if (meses[mesItem]) meses[mesItem].ingresos += Number(item.monto) || 0;
        });

        gastosFiltrados.forEach((item) => {
          const mesItem = item.fecha ? parseInt(item.fecha.split('-')[1] || '1', 10) - 1 : 0;
          if (meses[mesItem]) meses[mesItem].gastos += Number(item.monto) || 0;
        });

        const maxVal = Math.max(...meses.map((m) => Math.max(m.ingresos, m.gastos)), 1);

        return meses.map((m) => ({
          etiqueta: m.etiqueta,
          subetiqueta: m.subetiqueta,
          ingresos: m.ingresos,
          gastos: m.gastos,
          alturaIngresos: m.ingresos > 0 ? Math.max(12, Math.round((m.ingresos / maxVal) * 100)) : 0,
          alturaGastos: m.gastos > 0 ? Math.max(12, Math.round((m.gastos / maxVal) * 100)) : 0,
        }));
      }

      // Mensual por defecto (5 semanas)
      const mesAbrev = hoy.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '');
      const bloques = [
        { etiqueta: 'Semana 1', subetiqueta: `1 - 7 ${mesAbrev}`, start: 1, end: 7, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 2', subetiqueta: `8 - 14 ${mesAbrev}`, start: 8, end: 14, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 3', subetiqueta: `15 - 21 ${mesAbrev}`, start: 15, end: 21, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 4', subetiqueta: `22 - 28 ${mesAbrev}`, start: 22, end: 28, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 5', subetiqueta: `29 - 31 ${mesAbrev}`, start: 29, end: 31, ingresos: 0, gastos: 0 },
      ];

      ingresosFiltrados.forEach((item) => {
        const dia = item.fecha ? parseInt(item.fecha.split('-')[2] || '1', 10) : 1;
        const b = bloques.find((bl) => dia >= bl.start && dia <= bl.end) || bloques[0];
        b.ingresos += Number(item.monto) || 0;
      });

      gastosFiltrados.forEach((item) => {
        const dia = item.fecha ? parseInt(item.fecha.split('-')[2] || '1', 10) : 1;
        const b = bloques.find((bl) => dia >= bl.start && dia <= bl.end) || bloques[0];
        b.gastos += Number(item.monto) || 0;
      });

      const maxValor = Math.max(
        ...bloques.map((b) => Math.max(b.ingresos, b.gastos)),
        1
      );

      return bloques.map((b) => ({
        etiqueta: b.etiqueta,
        subetiqueta: b.subetiqueta,
        ingresos: b.ingresos,
        gastos: b.gastos,
        alturaIngresos: b.ingresos > 0 ? Math.max(12, Math.round((b.ingresos / maxValor) * 100)) : 0,
        alturaGastos: b.gastos > 0 ? Math.max(12, Math.round((b.gastos / maxValor) * 100)) : 0,
      }));
    })
  );

  setPeriodo(periodo: 'Semanal' | 'Mensual' | 'Anual'): void {
    this.periodoSeleccionado.set(periodo);
    this.periodoSubject.next(periodo);
  }

  exportarCSV(): void {
    const ingresos = this.incomeSvc.snapshot;
    const gastos = this.expenseSvc.snapshot;

    const lineas: string[] = [
      'Tipo,ID,Fecha,Concepto,Categoria/Fuente,Metodo/Cuenta,Monto_GTQ',
    ];

    ingresos.forEach((ing) => {
      const fila = [
        'INGRESO',
        `"${ing.id}"`,
        `"${ing.fecha}"`,
        `"${ing.concepto.replace(/"/g, '""')}"`,
        `"${ing.fuente.replace(/"/g, '""')}"`,
        `"${ing.cuentaDestino.replace(/"/g, '""')}"`,
        ing.monto.toFixed(2),
      ].join(',');
      lineas.push(fila);
    });

    gastos.forEach((gst) => {
      const fila = [
        'GASTO',
        `"${gst.id}"`,
        `"${gst.fecha}"`,
        `"${gst.concepto.replace(/"/g, '""')}"`,
        `"${gst.categoria.replace(/"/g, '""')}"`,
        `"${gst.metodoPago.replace(/"/g, '""')}"`,
        (-gst.monto).toFixed(2),
      ].join(',');
      lineas.push(fila);
    });

    const contenidoCSV = lineas.join('\r\n');
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_financiero_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
