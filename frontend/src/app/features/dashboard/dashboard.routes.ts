import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './layout/dashboard-layout.component';

export const dashboardRoutes: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./dashboard.component').then((m) => m.DashboardComponent),
        title: 'Control de Gastos - Panel Personal',
      },
      {
        path: 'ingresos',
        loadComponent: () =>
          import('./pages/ingresos/ingresos.component').then(
            (m) => m.IngresosComponent
          ),
        title: 'Control de Gastos - Flujo de Ingresos',
      },
      {
        path: 'gastos',
        loadComponent: () =>
          import('./pages/gastos/gastos.component').then(
            (m) => m.GastosComponent
          ),
        title: 'Control de Gastos - Gestión de Gastos',
      },
      {
        path: 'presupuestos',
        loadComponent: () =>
          import('./pages/presupuestos/presupuestos.component').then(
            (m) => m.PresupuestosComponent
          ),
        title: 'Control de Gastos - Presupuestos y Techos',
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./pages/categorias/categorias.component').then(
            (m) => m.CategoriasComponent
          ),
        title: 'Control de Gastos - Catálogo de Categorías',
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./pages/reportes/reportes.component').then(
            (m) => m.ReportesComponent
          ),
        title: 'Control de Gastos - Reportes y Análisis',
      },
      {
        path: 'ahorro',
        loadComponent: () =>
          import('./pages/ahorro/ahorro.component').then(
            (m) => m.AhorroComponent
          ),
        title: 'Control de Gastos - Fondos y Metas de Ahorro',
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./pages/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent
          ),
        title: 'Control de Gastos - Configuración del Sistema',
      },
    ],
  },
];
