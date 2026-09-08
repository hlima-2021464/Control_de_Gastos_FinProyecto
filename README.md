# Control de Gastos — Plataforma de Gestión Financiera Personal

Plataforma web de alto rendimiento orientada a la auditoría, proyección y control integral de finanzas personales, flujos de efectivo, presupuestos y metas de ahorro en tiempo real.

---

## Stack Tecnológico

| Capa | Tecnología | Descripción |
|---|---|---|
| **Frontend** | Angular 17+ / 22 | Arquitectura basada en componentes independientes (*Standalone Components*), *Signals* y *RxJS*. |
| **Estilos & UI** | TailwindCSS + CSS Nativo | Sistema de diseño *Dark Glassmorphism* con desenfoque de fondo (*backdrop-blur*), efectos neón y microinteracciones. |
| **Autenticación** | Dual (JWT Local + Google Identity Services GIS) | Acceso mediante credenciales tradicionales verificadas en base de datos y autorización federada con OAuth 2.0. |
| **Backend** | Node.js · TypeScript · Express | API REST modularizada estructurada en capas de controladores, servicios, repositorios y middlewares. |
| **Persistencia** | PostgreSQL 14+ / LocalStorage Sincronizado | Base de datos relacional para identidades y almacenamiento local reactivo respaldado por eventos de almacenamiento de ventana (*storage event*). |
| **Control de Sesión** | IdleService (RxJS Throttled) | Detección de inactividad del usuario en tiempo real con cierre forzado tras 15 minutos de inmovilidad y renovación continua durante la interacción activa. |

---

## Arquitectura del Proyecto

```text
Control-De-Gastos-Dashboard/
├── backend/                             # API REST (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/                      # Variables de entorno tipadas
│   │   ├── db/                          # Pool PostgreSQL y esquema DDL (schema.sql)
│   │   ├── middlewares/                 # Verificación JWT, control de roles y manejo de errores
│   │   ├── modules/
│   │   │   ├── auth/                    # Rutas, servicios y controladores de autenticación y refresh
│   │   │   └── users/                   # Repositorios y rutas de perfil de usuario
│   │   ├── utils/                       # Generación y validación de tokens JWT
│   │   ├── app.ts                       # Ensamblado de middlewares y enrutador global
│   │   └── server.ts                    # Punto de arranque HTTP
│   └── scripts/                         # CLI para inserción inicial de usuarios administradores
│
└── frontend/                            # SPA Angular (Standalone Architecture)
    └── src/
        ├── app/
        │   ├── core/                    # Núcleo compartido global
        │   │   ├── components/          # Modales transversales (Sesión Expirada)
        │   │   ├── guards/              # authGuard y roleGuard
        │   │   ├── interceptors/        # jwtInterceptor funcional
        │   │   ├── models/              # Interfaces de dominio financiero y autenticación
        │   │   └── services/            # Servicios reactivos de datos (Income, Expense, Budget, Category, Savings, Settings, Idle, Auth)
        │   ├── features/
        │   │   ├── login/               # Pantalla de inicio de sesión y Google GIS
        │   │   └── dashboard/           # Panel principal y módulos funcionales
        │   │       ├── layout/          # Barra lateral, navegación y barra superior con notificaciones
        │   │       ├── pages/           # Vistas especializadas (Gastos, Ingresos, Presupuestos, Categorías, Reportes, Ahorro, Configuración)
        │   │       ├── dashboard.component.ts # Métricas consolidadas en tiempo real
        │   │       └── dashboard.routes.ts    # Enrutamiento modular con lazy loading
        │   └── shared/                  # Componentes reutilizables
        ├── environments/                # Configuración de API y Google Client ID oficial
        └── styles.css                   # Sistema de diseño global y scrollbars personalizados
```

---

## Módulos y Capacidades del Sistema

### 1. Panel de Control (Dashboard)
- **Consolidación en Tiempo Real:** El *Balance Total* se calcula de forma reactiva como la diferencia estricta entre *Total de Ingresos* y *Total de Gastos*.
- **Histograma Dinámico:** Visualización gráfica de ingresos frente a egresos agrupados por semana, mes o consolidado anual.
- **Centro de Notificaciones Interactivo:** Panel desplegable en la barra superior con contador en vivo, opción para marcar alertas como leídas y vaciado del historial.

### 2. Gestión de Ingresos (`/dashboard/ingresos`)
- Registro, edición y eliminación de abonos monetarios.
- Desglose analítico por fuentes principales (*Nómina Fija*, *Desarrollo Web & Cloud*, *Consultorías*).
- Histograma de captación semanal con cálculo proporcional de barras.

### 3. Control de Gastos (`/dashboard/gastos`)
- Bitácora de egresos con concepto, monto, fecha, categoría y método de pago (efectivo o cuentas bancarias).
- Filtros reactivos instantáneos por término de búsqueda, rango de fechas y categoría asignada.

### 4. Presupuestos Mensuales (`/dashboard/presupuestos`)
- Establecimiento de techos financieros máximos por rubro de gasto.
- Barras de progreso de consumo con alertas visuales dinámicas (ámbar preventivo al 70% y rojo de advertencia al superar el 90%).
- Desplazamiento vertical optimizado mediante la rueda del ratón.

### 5. Catálogo de Categorías (`/dashboard/categorias`)
- Administración de clasificaciones diferenciadas para ingresos y gastos.
- Personalización de paleta cromática e iconografía.

### 6. Reportes Financieros (`/dashboard/reportes`)
- Proyección de liquidez, desglose de gastos y cálculo de tasa de ahorro mensual: `((Ingresos - Gastos) / Ingresos) * 100`.
- Exportación estructurada de estados de cuenta a formato CSV.

### 7. Metas de Ahorro (`/dashboard/ahorro`)
- Seguimiento de objetivos financieros con visualización de progreso porcentual respecto a la meta y fecha límite.
- Registro directo de abonos de capital a metas particulares.

### 8. Configuración y Preferencias (`/dashboard/configuracion`)
- Selector de divisa principal (Quetzales GTQ, Dólares USD, Euros EUR) con actualización en toda la interfaz.
- Parámetros de ciclo de corte financiero y ajuste del tiempo de tolerancia de inactividad de sesión.
- Motor de respaldo: Exportación e importación integral de datos en formato JSON.
- Zona de mantenimiento con restablecimiento seguro a línea base en cero mediante confirmación por palabra clave.

---

## Inicio Rápido y Despliegue Local

### Requisitos Previos
- **Node.js**: Versión 18.0.0 o superior.
- **Gestor de Paquetes**: `pnpm` o `npm`.
- **PostgreSQL**: Versión 14 o superior.

---

### Configuración del Backend

1. Acceda al directorio del servidor:
   ```bash
   cd backend
   ```
2. Instale dependencias:
   ```bash
   pnpm install
   ```
3. Genere el archivo de entorno `.env` tomando como base `.env.example`:
   ```ini
   PORT=3000
   CORS_ORIGIN=http://localhost:4200
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=control_gastos
   DB_USER=postgres
   DB_PASSWORD=su_contraseña
   JWT_SECRET=clave_secreta_para_firma_jwt
   JWT_EXPIRES_IN=8h
   ```
4. Inicialice el esquema de base de datos:
   ```bash
   psql -U postgres -d control_gastos -f src/db/schema.sql
   ```
5. (Opcional) Cree el usuario inicial mediante el script de siembra:
   ```bash
   pnpm run seed:user
   ```
6. Inicie el servicio en modo de desarrollo:
   ```bash
   pnpm run dev
   ```

---

### Configuración del Frontend

1. Acceda a la carpeta cliente en una nueva terminal:
   ```bash
   cd frontend
   ```
2. Instale las dependencias del proyecto:
   ```bash
   pnpm install
   ```
3. Ejecute el servidor de desarrollo:
   ```bash
   pnpm start
   ```
4. Abra el navegador en: `http://localhost:4200`.

---

## Estrategia de Ramas

El repositorio sigue un modelo de integración continua estructurado:

```text
hlima-2021464 (Desarrollo y características) ──> develop (Integración de cambios) ──> main (Despliegue formal)
```
