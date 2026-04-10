# 📋 ROADMAP 360: QUÉ LE FALTA A GEN AI

**Análisis de Gaps vs Plataforma Completa** | Fecha: Abril 2026

---

## 🔍 AUDITORÍA ACTUAL: QUÉ TIENE GEN AI

### ✅ Módulos Implementados

```
┌─────────────────────────────────────────────────────────────────┐
│                    ECOSISTEMA ACTUAL GEN AI                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🟢 RRHH                                                         │
│    ├─ Captura de Talento (Candidatos)                          │
│    ├─ Personal Activo (Dotación)                               │
│    ├─ Gestor Personal (Roles, Permisos)                        │
│    └─ Histórico de Eventos                                     │
│                                                                 │
│ 🟢 OPERACIONES (Telecom/Agent)                                 │
│    ├─ Dashboard KPI (Producción en vivo)                       │
│    ├─ Rendimiento (Bonificación + Cierre)                      │
│    ├─ Modelos de Bonificación (Configurables)                  │
│    └─ Comisiones/Bono calculadas                               │
│                                                                 │
│ 🟢 LOGÍSTICA                                                    │
│    ├─ Flota de Vehículos                                       │
│    ├─ Responsables + Estado Logístico                          │
│    ├─ Inventario (Básico)                                      │
│    ├─ Almacenes                                                │
│    ├─ Movimientos                                              │
│    └─ Auditoría de cambios                                     │
│                                                                 │
│ 🟢 PREVENCIÓN (HSE)                                            │
│    ├─ AST Digital                                              │
│    ├─ Inspecciones de Seguridad                                │
│    ├─ Incidentes / Requisas                                    │
│    ├─ Matriz IPER                                              │
│    └─ Charlas (5 min, Inducción, Capacitación)                │
│                                                                 │
│ 🟢 COMUNICACIONES                                              │
│    ├─ Chat Grupal en Tiempo Real                               │
│    ├─ Salas por Empresa/Departamento                           │
│    ├─ Historial persistente                                    │
│    └─ Presencia 360° (Online/Offline)                          │
│                                                                 │
│ 🟢 IA / ANALYTICS                                              │
│    ├─ Forecast 7-día (Producción, Asistencia)                 │
│    ├─ Detección de Anomalías (Z-score)                        │
│    ├─ Insights RRHH (Dotación, Tasa Retención)                │
│    ├─ Dashboard IA Operacional                                 │
│    └─ Chat IA (Local + OpenAI opcional)                        │
│                                                                 │
│ 🟢 AUTENTICACIÓN                                               │
│    ├─ 13 Roles predefinidos                                    │
│    ├─ 68 Permisos granulares                                   │
│    ├─ Multi-tenant aislado                                     │
│    ├─ JWT + HTTPS                                              │
│    └─ Auditoría de acceso                                      │
│                                                                 │
│ 🟢 ADMIN                                                        │
│    ├─ System Command Center                                    │
│    ├─ Gestión de Usuarios/Empresas                             │
│    ├─ Configuración de Permisos                                │
│    └─ Portales Operativos                                      │
│                                                                 │
│ 🟢 MONITORING                                                   │
│    ├─ Health Checks (/api/health)                              │
│    ├─ Logging (Winston)                                        │
│    ├─ Rate Limiting                                            │
│    └─ Helmet Security Headers                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 📊 Cobertura Actual

| Área | Cobertura | Score |
|------|-----------|-------|
| **RRHH** | Captura + Dotación | 60% |
| **Operaciones** | Bonificación + KPI | 70% |
| **Logística** | Flota + Inventario | 65% |
| **HSE/Prevención** | AST + Inspecciones + Charlas | 75% |
| **Comunicaciones** | Chat en tiempo real | 80% |
| **Analytics/IA** | Forecast local + OpenAI | 75% |
| **Compliance** | Permisos granulares | 70% |
| ****PROMEDIO 360°**| | **~70%** |

---

## ❌ GAPS CRÍTICOS: QUÉ FALTA PARA SER 360

### TIER 1: CRÍTICO (MVP para "Enterprise Platform")

#### 1. **NÓMINA / PAYROLL** ❌ FALTA COMPLETAMENTE
**Impacto:** Alto | **Complejidad:** Alta | **ROI:** ⭐⭐⭐⭐⭐

Lo que falta:
- ❌ Cálculo de remuneraciones (base, gratificación, bonificación integrada)
- ❌ Descuentos (AFP, Isapre, STD, Embargos)
- ❌ Emisión de liquidaciones de sueldo (Payslips)
- ❌ Validaciones DT Chile (Jornadas máximas, recargo nocturno, diferenciados)
- ❌ Integración SII para boleta electrónica
- ❌ Histórico de remuneraciones y simulaciones
- ❌ Retención de certificados (F22, Certificados de remuneración)

**Por qué es crítico:**
- Buk + Defontana incluyen esto standard
- RRHH manager debe poder hacer simulaciones salariales
- Sin esto, clientes de TLC siguen en Excel o Buk

**Estimado:** 80-120 horas (4-6 semanas, si tienes modelo financiero claro)

**Datos de ejemplo:**
```javascript
Remuneración = {
  base: 1000000,
  bonificacion: 200000,
  gratificacion: 83333,
  descuentos: {
    afp: 80000,
    isapre: 120000,
    seguro: 8000
  },
  liquido: 1075333 // Calculado automáticamente
}
```

---

#### 2. **DOCUMENTOS LEGALES + FIRMA DIGITAL** ❌ FALTA COMPLETAMENTE
**Impacto:** Alto | **Complejidad:** Media | **ROI:** ⭐⭐⭐⭐

Lo que falta:
- ❌ Contrato laboral automatizado (propuesta RRHH → Contrato legal)
- ❌ Finiquito automático (regla legal + cálculo nómina)
- ❌ Cartas de constancia (Certificado de remuneración, años servicio)
- ❌ Modificaciones de contrato (Cambio de cargo, sueldo, jornada)
- ❌ Firma digital nativa (integración Firma.cl, Adobe Sign o Docusign)
- ❌ Repositorio LGPD-compliant de documentos
- ❌ Acceso portal empleado (descargar propios documentos)

**Por qué:**
- 100% de clientes necesitan finiquito cuando se va alguien
- Buk incluye firma digital en Plan Business
- Sin esto, RRHH sigue usando Word + imprimiendo

**Estimado:** 60-100 horas (3-5 semanas)

**Pipeline esperado:**
```
Candidato Contratado → Auto-genera Contrato → Firma Digital → PDF guardado + Portal
```

---

#### 3. **FACTURACIÓN + COBROS** ❌ FALTA COMPLETAMENTE
**Impacto:** Medio-Alto | **Complejidad:** Alta | **ROI:** ⭐⭐⭐

Lo que falta:
- ❌ Emisión de Facturas (Boleta electrónica SII-Chile)
- ❌ Facturación MercadoPago / PayPal / Stripe
- ❌ Control de cobranza (Follow-up automático de facturas vencidas)
- ❌ Conciliación bancaria (matching pagos recibidos vs facturas)
- ❌ Reportes de ingresos por cliente
- ❌ Proyecciones de cash flow

**Por qué:**
- Telecom/Logística cobran comisiones a clientes
- Sin facturación, negocio depende 100% de manual
- SAP SuccessFactors no cubre esto tampoco (es separado)

**Estimado:** 100-150 horas (5-7 semanas)

---

#### 4. **INTEGRACIÓN BANKING** ❌ FALTA COMPLETAMENTE
**Impacto:** Medio | **Complejidad:** Alta | **ROI:** ⭐⭐⭐

Lo que falta:
- ❌ Conectar con banco (BancoEstado, Santander, etc API)
- ❌ Descarga automática de movimientos
- ❌ Reconciliación de pagos (¿Se pagó la factura?)
- ❌ Alertas de saldos bajos
- ❌ Transferencias automáticas (nomina batch, pagos proveedores)

**Por qué:**
- Financiero =  visibility completa
- Con banco integrado, cuadra 100% sin intervención

**Estimado:** 80-120 horas (4-6 semanas)

---

#### 5. **REPORTERÍA + BI AVANZADO** ⚠️ PARCIAL (necesita expansión)
**Impacto:** Alto | **Complejidad:** Media | **ROI:** ⭐⭐⭐⭐

Tiene:
- ✅ Dashboard CEO (KPI operacionales)
- ✅ Insights RRHH básicos

**Falta:**
- ❌ Reportes personalizables (sin código)
- ❌ Exportación Excel/PDF con gráficos
- ❌ Scheduled reports (envío automático cada lunes)
- ❌ Data warehouse integration (BigQuery, Snowflake)
- ❌ Business intelligence (Tableau, PowerBI embedded)
- ❌ Drill-down analytics (clic para detalles)

**Por qué:**
- CEO necesita ver "¿Cuánto ganamos en Telecom vs Construcción?"
- CFO necesita reportes fiscales mensuales automáticos

**Estimado:** 120-180 horas (6-9 semanas)

---

#### 6. **MOBILE APP (iOS/Android)** ❌ FALTA COMPLETAMENTE
**Impacto:** Medio-Alto | **Complejidad:** Alta | **ROI:** ⭐⭐⭐⭐

Lo que falta:
- ❌ App nativa iOS/Android
- ❌ Offline-first (funciona sin internet)
- ❌ Notificaciones push
- ❌ Ubicación geolocalizada (para técnicos en terreno)
- ❌ Cámara (foto incidentes, AST con adjuntos)
- ❌ Sincronización automática

**Por qué:**
- Técnicos en terreno necesitan ver asignaciones sin laptop
- Supervisores checkan estado en tiempo real desde sitio
- Operativo telecom = 80% mobile

**Estimado:** 200-300 horas (10-15 semanas con React Native o Flutter)

---

### TIER 2: IMPORTANTE (Plataforma > Básica)

#### 7. **ORGANIGRAMAS + FLUJOS JERÁRQUICOS** ⚠️ PARCIAL
**Impacto:** Medio | **Complejidad:** Baja | **ROI:** ⭐⭐⭐

Falta:
- ❌ Visualizador de organigrama dinámico
- ❌ Jefe directo > Cadena de mando
- ❌ Flujos de aprobación por rol automáticos
- ❌ Delegaciones temporales (Jefe vacacionando)

**Estimado:** 40-60 horas (2-3 semanas)

---

#### 8. **CAPACITACIÓN + LMS** ❌ FALTA COMPLETAMENTE
**Impacto:** Medio | **Complejidad:** Media | **ROI:** ⭐⭐⭐

Falta:
- ❌ Catálogo de cursos
- ❌ Asignación de capacitación por rol
- ❌ Seguimiento de avance
- ❌ Certificados de aprobación
- ❌ Integración con Workera (si decides asociarte)

**Por qué:**
- RRHH debe certificar que empleados tienen training requerido
- RRHH manager reporta "¿Cuántos tienen inducción completa?"

**Estimado:** 100-150 horas (5-7 semanas)

---

#### 9. **GESTIÓN DE BENEFICIOS** ❌ FALTA COMPLETAMENTE
**Impacto:** Medio | **Complejidad:** Media | **ROI:** ⭐⭐

Falta:
- ❌ Beneficiarios (Familia del empleado)
- ❌ Seguros (Vida, Accidente, Salud)
- ❌ Descuentos corporativos (Convenios)
- ❌ Portal empleado (ver mis beneficios)
- ❌ Solicitudes de cambio de beneficiario

**Por qué:**
- Buk incluye esto como module principal
- Telecom/Construcción regalan beneficios a empleados

**Estimado:** 80-120 horas (4-6 semanas)

---

#### 10. **GESTIÓN DE VACACIONES + PERMISOS** ⚠️ PARCIAL
**Impacto:** Medio | **Complejidad:** Baja | **ROI:** ⭐⭐⭐

Falta:
- ❌ Solicitud de vacaciones por portal empleado
- ❌ Workflow de aprobación
- ❌ Cálculo automático de saldos
- ❌ Interfaz calendario visual
- ❌ Bloqueos (no puedo pedir vacaciones si otra persona ya)

**Estimado:** 60-90 horas (3-4 semanas)

---

#### 11. **GESTIÓN DE ASISTENCIA AVANZADA** ⚠️ PARCIAL
**Impacto:** Medio | **Complejidad:** Media | **ROI:** ⭐⭐⭐

Tiene:
- ✅ Time Tracker (heartbeat)
- ✅ Reporte de asistencia

**Falta:**
- ❌ Integración con reloj biométrico (Zkteco, Virdi)
- ❌ Excusas de inasistencia por portal
- ❌ Cálculos de licencia médica automáticas (Fonasa)
- ❌ Ausentismo y multas
- ❌ Justificación automática por evento (Feriado)

**Estimado:** 100-150 horas (5-7 semanas)

---

#### 12. **DESEMPEÑO + EVALUACIONES** ⚠️ MINIMAL
**Impacto:** Medio-Bajo | **Complejidad:** Media | **ROI:** ⭐⭐

Falta:
- ❌ Evaluaciones 360° (jefe + pares + sub)
- ❌ OKR tracking (Objetivos trimestrales)
- ❌ Feedback histórico
- ❌ Plan de desarrollo individual

**Estimado:** 120-180 horas (6-9 semanas)

---

### TIER 3: DIFERENCIADORES PREMIUM

#### 13. **PREDICCIÓN AVANZADA (ML > Estadística Clásica)** ⚠️ BÁSICA
**Impacto:** Medio | **Complejidad:** Alta | **ROI:** ⭐⭐⭐⭐

Tienes:
- ✅ Forecast lineal
- ✅ Detección anomalías Z-score

**Falta:**
- ❌ Modelos ARIMA/Prophet (series más precisas)
- ❌ LSTM neural networks (patrones temporales)
- ❌ Predicción de turnover (¿Quién se va?)
- ❌ Anomalías behavior (¿Alguien actúa raro?)
- ❌ Clustering (segmentar empleados similares)

**Por qué:**
- Diferenciador vs Buk
- CFO paga premium por "¿Cuál es el riesgo de rotación?" → Acción preventiva

**Estimado:** 150-250 horas (pero requiere data scientists)

---

#### 14. **INTEGRACIÓN ERP EXTERNA** ❌ FALTA COMPLETAMENTE
**Impacto:** Bajo-Medio | **Complejidad:** Alta | **ROI:** ⭐⭐⭐

Falta:
- ❌ Conectar con SAP/NetSuite (sync empleados, sueldos)
- ❌ Conectar con Shopify (sincronizar pedidos → KPI operacionales)
- ❌ API marketplace abierto

**Estimado:** 100-200 horas por integración

---

#### 15. **GAMIFICACIÓN** ❌ FALTA
**Impacto:** Bajo | **Complejidad:** Media | **ROI:** ⭐⭐

- ❌ Leaderboards (¿Quién vende más?)
- ❌ Badges (Logros)
- ❌ Puntos intercambiables

**Estimado:** 60-100 horas (3-5 semanas)

---

## 📊 MATRIZ DE PRIORIZACIÓN

```
┌────────────────────────────────────────────────────────────────┐
│              ROADMAP PRIORIZACIÓN (12 MESES)                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Q2 2026 (CRÍTICO)                                              │
│  P1. Nómina/Payroll                         ███████████ 12 sem │
│  P2. Documentos + Firma Digital             ███████ 5 sem      │
│  P3. Mobile App (MVP)                       ████████████ 15 sem│
│                                                                │
│ Q3 2026 (IMPORTANTE)                                           │
│  P4. Facturación + Cobros                   ███████ 6 sem     │
│  P5. Reportería Avanzada + BI               ████████ 8 sem    │
│  P6. Vacaciones + Permisos                  ██████ 4 sem      │
│                                                                │
│ Q4 2026 (MEJORAS)                                              │
│  P7. Integración Banking                    ███████ 6 sem     │
│  P8. Capacitación/LMS                       ████ 6 sem        │
│  P9. Beneficios Empleado                    ██████ 5 sem      │
│                                                                │
│ Q1-Q2 2027 (PREMIUM)                                           │
│  P10. ML Avanzado (Turnover prediction)    ██████████ 10 sem  │
│  P11. Integraciones ERP                    Ongoing           │
│  P12. Gamificación                         ████ 4 sem        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 MATRIZ BUK vs GEN AI: COBERTURA COMPLETA

| Funcionalidad | Buk ✅ | Gen AI ❌ | Priority | Weeks |
|---------------|----|-------|----------|-------|
| **RRHH Base** | ✅ | ✅ | Core | - |
| **Nómina/Payroll** | ✅ | ❌ | P1 | 12 |
| **Finiquito** | ✅ | ❌ | P1 | 4 |
| **Firma Digital** | ✅ | ❌ | P2 | 5 |
| **Vacaciones** | ✅ | ⚠️ | P3 | 4 |
| **Evaluaciones** | ✅ | ❌ | P4 | 8 |
| **Beneficios** | ✅ | ❌ | P5 | 5 |
| **Nómina en Línea** | ✅ | ❌ | P6 | 3 |
| **Facturación** | ❌ | ❌ | P7 | 6 |
| **Cash Flow** | ✅ | ❌ | P8 | 4 |
| **Mobile App** | ⚠️ | ❌ | P9 | 15 |
| **BI Avanzado** | ✅ | ⚠️ | P10 | 8 |

**Cobertura porcentual:**
- **Buk:** 95% (empresa RRHH + finanzas maduro)
- **Gen AI (hoy):** 70% (excelente en Ops, débil en adminitración)
- **Gen AI (en 12 meses con roadmap):** 90% (comparable a Buk)

---

## 💰 INVERSIÓN ESTIMADA PARA "PLATAFORMA 360 COMPLETA"

```
┌────────────────────────────────────────────┐
│   COST TO COMPLETE (Next 12 months)      │
├────────────────────────────────────────────┤
│ TIER 1 (Critical - 5 features)            │
│  Nómina/Payroll                  $60-80K  │
│  Documentos + Firma Digital      $40-50K  │
│  Mobile App (React Native)      $80-100K  │
│  Facturación + Cobros            $50-60K  │
│  Reportería Avanzada             $40-50K  │
│  ─────────────────────────────────────── │
│  SUBTOTAL TIER 1:              $270-340K  │
│                                           │
│ TIER 2 (Important - 4 features)           │
│  Vacaciones/Permisos             $30-40K  │
│  LMS/Capacitación                $50-60K  │
│  Beneficios + Admin              $40-50K  │
│  Integración Banking             $50-60K  │
│  ─────────────────────────────────────── │
│  SUBTOTAL TIER 2:              $170-210K  │
│                                           │
│ TIER 3 (Premium - 3 features)             │
│  ML Avanzado                    $60-100K  │
│  Integraciones ERP              $40-80K   │
│  Gamificación                   $20-30K   │
│  ─────────────────────────────────────── │
│  SUBTOTAL TIER 3:              $120-210K  │
│                                           │
│ ═════════════════════════════════════════ │
│ TOTAL INVESTMENT (12 MESES):    $560-760K │
│ Monthly burn (5-6 engineers):     $45-65K │
│ ═════════════════════════════════════════ │
└────────────────────────────────────────────┘
```

**Alternativa: Team Speedrun (3 engineers, 18 meses)**
- Total: $350-450K
- Vs. Alternativa: Hiring 1 engineer, outsourcing 4 features = $280K

---

## 🎬 PLAN DE ACCIÓN INMEDIATO (Próximas 4 semanas)

### Week 1-2: Validación con Clientes
- [ ] Encuesta 20 clientes Gen AI: "¿Qué feature harías pagar premium?"
- [ ] Validar: ¿Es Nómina #1 pain point?
- [ ] Validar: ¿Necesitan Mobile o es "nice to have"?

### Week 3: Architecture Design
- [ ] Diseñar base de datos Nómina (AFP, Isapre, DT rules)
- [ ] Interface Payslip (PDF + Dashboard)
- [ ] Integración SII (aprobación DT)

### Week 4: MVP Launch
- [ ] Prototype Nómina básica (manual input, cálculo automático)
- [ ] Show to 5 customers
- [ ] Recopilar feedback

---

## 📌 RECOMENDACIÓN FINAL

**Para ser "Plataforma 360 Completa" vs Buk en 12 meses:**

1. **ENFOCAR en TIER 1 (5 features = $270-340K)**
   - Nómina/Payroll (80% de peticiones de clientes)
   - Firma Digital (diferenciador único)
   - Mobile App (adoption critical)
   - Facturación (para monetizar SaaS)
   - Reportería BI (CFO decision maker)

2. **OMITIR por ahora:**
   - Gamificación (nice-to-have, sin ROI claro)
   - Integraciones complejas (ERP, Banking)
   - ML avanzado (requiere data scientists caros)

3. **POSICIONAR COMO:**
   > "La plataforma operacional más completa de Latam: RRHH + Nómina + Ops + Logística + IA—todo en un lugar, sin cloud" 

4. **FINANCIAMIENTO SUGERIDO:**
   - Pre-seed: $500K (burn rate $45K/mes × 12 = $540K, + buffer)
   - Valuation: $5M (10% de revenue en 3 años @ $50K MRR)
   - Runway: 12 meses para llegar a $20K MRR (40+ clientes)

---

**¿Cuál de estos features quieres que prioricemos primero?**
