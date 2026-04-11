const BRAND = {
  companyName: 'Synoptyk',
  productName: 'GENAI360',
  fullName: 'GENAI360 by Synoptyk',
  shortName: 'GENAI360',
  platformLabel: 'GENAI360 Platform',
  publicAppUrl: process.env.APP_PUBLIC_URL || 'https://www.genai.cl',
  logoUrl: process.env.BRAND_LOGO_URL || 'https://www.genai.cl/genai-assistant-logo.png',
  defaultBcc: process.env.NOTIFY_BCC || 'admin@synoptyk.cl'
};

const appLink = (path = '/login') => `${BRAND.publicAppUrl}${path}`;

module.exports = {
  BRAND,
  appLink
};
