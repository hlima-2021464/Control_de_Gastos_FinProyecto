import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IncomeService } from '../../../../core/services/income.service';
import { ExpenseService } from '../../../../core/services/expense.service';

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

  readonly periodoSeleccionado = signal<'Semanal' | 'Mensual' | 'Anual'>('Mensual');

  // ─── Métricas Analíticas Consolidadas ────────────────────────
  readonly metricas$: Observable<MetricasAnaliticas> = combineLatest([
    this.incomeSvc.totalIngresos$,
    this.expenseSvc.totalGastos$,
  ]).pipe(
    map(([ingresos, gastos]) => {
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
  readonly barrasComparativas$: Observable<ComparativoPeriodo[]> = combineLatest([
    this.incomeSvc.ingresos$,
    this.expenseSvc.gastos$,
    this.incomeSvc.totalIngresos$,
    this.expenseSvc.totalGastos$,
  ]).pipe(
    map(([ingresos, gastos]) => {
      // 5 Bloques temporales mensuales
      const bloques = [
        { etiqueta: 'Semana 1', subetiqueta: '1 - 7 Ago', start: 1, end: 7, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 2', subetiqueta: '8 - 14 Ago', start: 8, end: 14, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 3', subetiqueta: '15 - 21 Ago', start: 15, end: 21, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 4', subetiqueta: '22 - 28 Ago', start: 22, end: 28, ingresos: 0, gastos: 0 },
        { etiqueta: 'Semana 5', subetiqueta: '29 - 31 Ago', start: 29, end: 31, ingresos: 0, gastos: 0 },
      ];

      ingresos.forEach((item) => {
        const dia = item.fecha ? parseInt(item.fecha.split('-')[2] || '1', 10) : 1;
        const b = bloques.find((bl) => dia >= bl.start && dia <= bl.end) || bloques[0];
        b.ingresos += Number(item.monto) || 0;
      });

      gastos.forEach((item) => {
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
        alturaIngresos: b.ingresos > 0 ? Math.max(10, Math.round((b.ingresos / maxValor) * 100)) : 0,
        alturaGastos: b.gastos > 0 ? Math.max(10, Math.round((b.gastos / maxValor) * 100)) : 0,
      }));
    })
  );

  setPeriodo(periodo: 'Semanal' | 'Mensual' | 'Anual'): void {
    this.periodoSeleccionado.set(periodo);
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
