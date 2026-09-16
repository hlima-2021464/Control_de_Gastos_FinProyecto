# Control de Gastos — Plataforma de Gestión Financiera Personal

Plataforma web integral orientada a la auditoría, proyección y control riguroso de finanzas personales, flujos de efectivo, presupuestos y metas de ahorro en tiempo real.

---

## Stack Tecnológico

| Capa | Tecnología | Descripción |
|---|---|---|
| **Frontend** | Angular Standalone (v17+ / v22) | Arquitectura modular basada en componentes independientes, *Signals* y reactividad con *RxJS*. |
| **Estilos & UI** | TailwindCSS + CSS Nativo | Sistema de diseño *Dark Glassmorphism* con desenfoque de fondo (*backdrop-blur*), efectos neón y microinteracciones. |
| **Autenticación** | Dual (JWT Local + Google Identity Services GIS) | Acceso mediante credenciales tradicionales verificadas en base de datos y autorización federada con OAuth 2.0. |
| **Backend** | Node.js · TypeScript · Express | API REST estructurada en capas de controladores, servicios, repositorios y middlewares con tipado estricto. |
| **Persistencia** | PostgreSQL + LocalStorage Sincronizado | Base de datos relacional para identidades y almacenamiento local reactivo respaldado por eventos de almacenamiento de ventana (*storage event*). |
| **Control de Sesión** | IdleService (RxJS Throttled) | Detección reactiva de inactividad con cierre forzado tras el período configurado y renovación automática durante la interacción. |

---

## Módulos y Reglas de Negocio del Sistema

### 1. Panel de Control (Dashboard)
- **Consolidación en Tiempo Real:** El *Balance Total* se calcula de forma reactiva considerando ingresos, egresos y capital resguardado: `Balance = Ingresos - Gastos - Ahorro`.
- **Histograma Unificado:** Gráfica de captación que proyecta el comportamiento financiero por bloques de ciclo con columnas sólidas dinámicas.
- **Centro de Notificaciones en Vivo:** Alertas automáticas y reactivas ante límites de presupuesto (80% y 100%), abonos registrados y movimientos de metas, con sincronización de lectura y acción de vaciado inmediato.
- **Cuadrícula Inferior de 3 Columnas:** Desglose equilibrado de *Gastos Recientes*, barras de progreso de *Presupuesto* y panel interactivo de *Notificaciones*.

### 2. Gestión de Ingresos (`/dashboard/ingresos`)
- Registro, edición y auditoría de entradas de capital por concepto y fuente contable (*Nómina Fija*, *Desarrollo Web & Hosting*, *Consultorías de Sistemas*).
- Histograma de captación semanal en cuatro columnas con cálculo de promedios por ciclo y total mensual percibido.
- Formulario depurado sin campos redundantes de destino contable.

### 3. Control de Gastos (`/dashboard/gastos`)
- Bitácora de débitos con categorización estricta, método de pago y montos formateados.
- **Validación de Liquidez Insuficiente:** Bloqueo preventivo que impide registrar gastos que excedan la liquidez disponible real, evitando saldos negativos.
- **Restricción Cronológica:** Validación de fechas que impide asentar o editar transacciones con fechas posteriores al día en curso.
- Filtros reactivos instantáneos por término de búsqueda, categoría y rango de fechas.

### 4. Presupuestos Mensuales (`/dashboard/presupuestos`)
- Establecimiento de techos financieros máximos por rubro operativo.
- Barras de progreso con semaforización preventiva: consumo óptimo (< 70%), atención preventiva (70% - 89%) y riesgo de sobregiro (≥ 90%).

### 5. Catálogo de Categorías (`/dashboard/categorias`)
- Administración y parametrización de taxonomías para gastos e ingresos.
- Protección de integridad referencial: bloqueo de eliminación para categorías con movimientos financieros activos asociados.

### 6. Reportes y Análisis (`/dashboard/reportes`)
- Evaluación analítica de solvencia, desglose de débitos y cálculo de tasa de ahorro neta: `((Ingresos - Gastos) / Ingresos) * 100`.
- Comparativa temporal mediante gráficos de barras paralelas por intervalos cronológicos.
- **Exportación Contable CSV:** Generación programática en cliente de bitácoras conformes con el estándar RFC 4180 para su análisis en hojas de cálculo.

### 7. Fondos y Metas de Ahorro (`/dashboard/ahorro`)
- Seguimiento de alcancías financieras con cálculo de cumplimiento porcentual y fecha límite.
- **Gestión Bidireccional de Fondos:** Modalidades de abono directo y retiro de capital (validando no superar el saldo acumulado), integradas al balance global.

### 8. Configuración del Sistema (`/dashboard/configuracion`)
- **Diseño Comprimido:** Interfaz compacta organizada en tarjetas de *Perfil de Acceso*, *Preferencias Regionales* y *Copia de Seguridad y Datos*.
- **Conversión Monetaria Multidivisa:** Recálculo algebraico real de saldos frente a tasas referenciales de cambio (Quetzales GTQ base, Dólares USD a 7.80 y Euros EUR a 8.50).
- **Control de Respaldo y Purga:** Motor de exportación e importación integral en JSON, junto con zona de mantenimiento crítico con confirmación mediante palabra clave.

---

## Configuración y Despliegue Local

### 1. Variables de Entorno del Servidor (`backend/.env`)
```ini
PORT=3000
CORS_ORIGIN=http://localhost:4200

# Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_gastos
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Autenticación JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=8h
```

### 2. Ejecución de los Servicios
```bash
# Backend
cd backend
pnpm install
pnpm run dev

# Frontend
cd ../frontend
pnpm install
pnpm start
```

---

## Estrategia de Ramas
```plaintext
hlima-2021464 (Desarrollo y entrega) ──> develop ──> main
```
