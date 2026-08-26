/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── GenAI360 Brand Palette (extraída del logo V1) ──────────
        brand: {
          navy:    '#0d1854',  // Azul marino profundo (fondo sidebar)
          navyL:   '#1a237e',  // Azul índigo (hover sidebar)
          blue:    '#1565c0',  // Azul real eléctrico (primario)
          blueL:   '#1976d2',  // Azul real claro (hover)
          blueXL:  '#e3f2fd',  // Azul muy claro (fondos claros)
          violet:  '#5c35d4',  // Azul-violeta (banda cruzada del logo)
          violetL: '#7c4dff',  // Violeta brillante (hover)
          green:   '#00897b',  // Verde esmeralda (éxito)
          greenL:  '#26a69a',  // Verde esmeralda claro
          greenXL: '#e0f2f1',  // Verde muy claro (fondos)
          gold:    '#f59e0b',  // Ámbar dorado (destacados, KPI)
          goldL:   '#fbbf24',  // Dorado claro
          goldXL:  '#fef3c7',  // Dorado muy claro (fondos)
          cyan:    '#00bcd4',  // Cyan luminoso (el ° del logo)
          cyanL:   '#26c6da',  // Cyan claro
          cyanXL:  '#e0f7fa',  // Cyan muy claro (fondos)
          // Neutros brand
          dark:    '#0a0f2e',  // Casi negro (texto en dark)
          muted:   '#8fa3c0',  // Texto secundario en sidebar
        }
      },
      backgroundImage: {
        // Gradientes de marca
        'brand-primary':  'linear-gradient(135deg, #1565c0 0%, #5c35d4 100%)',
        'brand-sidebar':  'linear-gradient(180deg, #0d1854 0%, #0a1442 100%)',
        'brand-hero':     'linear-gradient(135deg, #0d1854 0%, #1565c0 50%, #5c35d4 100%)',
        'brand-gold':     'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
        'brand-green':    'linear-gradient(135deg, #00695c 0%, #00897b 100%)',
        'brand-cyan':     'linear-gradient(135deg, #00bcd4 0%, #00acc1 100%)',
      },
      boxShadow: {
        // Sombras premium existentes
        'premium':        '0 20px 50px rgba(0, 0, 0, 0.04)',
        'premium-hover':  '0 30px 70px rgba(0, 0, 0, 0.06)',
        'premium-inset':  'inset 0 2px 10px rgba(0, 0, 0, 0.02)',
        // Sombras brand
        'brand-blue':     '0 8px 32px rgba(21, 101, 192, 0.35)',
        'brand-blue-lg':  '0 16px 48px rgba(21, 101, 192, 0.45)',
        'brand-gold':     '0 8px 24px rgba(245, 158, 11, 0.35)',
        'brand-green':    '0 8px 24px rgba(0, 137, 123, 0.35)',
        'brand-violet':   '0 8px 32px rgba(92, 53, 212, 0.35)',
        'brand-cyan':     '0 8px 24px rgba(0, 188, 212, 0.30)',
        'sidebar-glow':   '4px 0 24px rgba(13, 24, 84, 0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':       'fadeIn 0.3s ease-out',
        'slide-up':      'slideUp 0.4s ease-out',
        'pulse-brand':   'pulseBrand 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow':          'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn:      { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:     { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseBrand:  { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
        glow:        { from: { boxShadow: '0 0 8px rgba(0,188,212,0.4)' }, to: { boxShadow: '0 0 20px rgba(0,188,212,0.8)' } },
      },
    },
  },
  plugins: [],
}