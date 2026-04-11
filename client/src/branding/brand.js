export const BRAND = {
  companyName: 'Synoptyk',
  productName: 'GENAI360',
  fullName: 'GENAI360 by Synoptyk',
  shortName: 'GENAI360',
  platformLabel: 'Enterprise Platform',
  platformLabelLatam: 'Enterprise Platform LATAM v8.0',
  tagline: 'Operación unificada para empresas exigentes de Chile, Colombia, Perú, México y Argentina.',
  countries: ['Chile', 'Colombia', 'Perú', 'México', 'Argentina'],
  countryCampaigns: {
    Chile: 'Cumplimiento, operación y trazabilidad de punta a punta.',
    Colombia: 'Escalabilidad regional con gobierno operativo en tiempo real.',
    'Perú': 'Ejecución en terreno con control integral de seguridad y producción.',
    'México': 'Orquestación multi-sede con visibilidad 360 y decisiones más rápidas.',
    Argentina: 'Eficiencia financiera-operativa con procesos auditables de extremo a extremo.'
  },
  logoPath: '/genai-assistant-logo.png',
  aiModuleLabel: 'GENAI360',
  aiAssistantLabel: 'Asistente GENAI360',
  aiSupportLabel: 'GENAI360 Support',
  tabTitle: 'GENAI360 | Synoptyk',
  metaDescription: 'GENAI360 by Synoptyk. Plataforma empresarial para operaciones, prevención, producción, logística, RRHH, aprobaciones e inteligencia operativa.',
  loginFooter: 'GENAI360 · LATAM 2026'
};

export function applyGlobalBranding() {
  if (typeof document === 'undefined') return;

  document.title = BRAND.tabTitle;

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', BRAND.metaDescription);

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute('content', BRAND.shortName);

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.setAttribute('href', BRAND.logoPath);

  const appleTouch = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleTouch) appleTouch.setAttribute('href', BRAND.logoPath);
}