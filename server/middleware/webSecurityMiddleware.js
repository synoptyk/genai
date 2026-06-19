/**
 * Web Security Middleware
 * Protecciones contra CSRF, XSS, SQL injection y otros ataques web
 */

const crypto = require('crypto');

/**
 * Middleware para validar solicitudes (CSRF Token)
 */
const csrfProtection = (req, res, next) => {
  // GET requests - generar token CSRF
  if (req.method === 'GET') {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.locals.csrfToken = csrfToken;
    // Para APIs, devolver token en header o cookie
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    });
  }

  // POST/PUT/DELETE - validar CSRF token
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const tokenFromHeader = req.headers['x-csrf-token'];
    const tokenFromBody = req.body?.csrfToken;
    const tokenFromCookie = req.cookies?.['XSRF-TOKEN'];

    const providedToken = tokenFromHeader || tokenFromBody;

    // Validar token (si viene en body/header debe coincidir con cookie)
    if (!providedToken && tokenFromCookie) {
      // Token solo en cookie es aceptable para ciertas operaciones
    } else if (providedToken && providedToken === tokenFromCookie) {
      // Token coincide
    } else if (!providedToken && !tokenFromCookie) {
      // Sin protección CSRF - permitir solo si es API con Authorization
      const hasAuth = !!req.headers.authorization;
      if (!hasAuth) {
        return res.status(403).json({
          error: 'CSRF Protection',
          message: 'Missing CSRF token'
        });
      }
    }
  }

  next();
};

/**
 * Middleware para prevenir inyección de código en JSON
 */
const jsonInjectionProtection = (req, res, next) => {
  if (!req.body) {
    return next();
  }

  // Revisar que no haya código JavaScript en los valores
  const hasCodeInjection = JSON.stringify(req.body).includes('__proto__');

  if (hasCodeInjection) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Detected potentially malicious data'
    });
  }

  next();
};

/**
 * Middleware para sanitizar inputs
 */
const sanitizeInputs = (req, res, next) => {
  const { sanitizeInput } = require('./secretsManager');

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Sanitiza recursivamente un objeto
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Remover HTML y caracteres peligrosos
      sanitized[key] = value
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .substring(0, 10000);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware para validar estructura de JSON
 */
const validateJsonStructure = (maxDepth = 10) => {
  return (req, res, next) => {
    if (!req.body) {
      return next();
    }

    const checkDepth = (obj, depth = 0) => {
      if (depth > maxDepth) {
        throw new Error('JSON depth exceeds maximum allowed');
      }

      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const value of Object.values(obj)) {
        if (typeof value === 'object') {
          checkDepth(value, depth + 1);
        }
      }
    };

    try {
      checkDepth(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid request',
        message: error.message
      });
    }
  };
};

/**
 * Middleware para validar y sanitizar URLs
 */
const sanitizeUrls = (req, res, next) => {
  if (req.body?.redirectUrl || req.query?.redirectUrl) {
    const url = req.body?.redirectUrl || req.query?.redirectUrl;
    
    // Solo permitir URLs relativas o del mismo dominio
    if (url.startsWith('http')) {
      try {
        const urlObj = new URL(url);
        const allowedHosts = [
          process.env.FRONTEND_URL,
          'genai.cl',
          'www.genai.cl'
        ];
        
        if (!allowedHosts.some(host => urlObj.host.includes(host))) {
          return res.status(400).json({
            error: 'Invalid redirect URL'
          });
        }
      } catch {
        return res.status(400).json({
          error: 'Invalid URL format'
        });
      }
    }
  }

  next();
};

/**
 * Middleware para loguear intentos sospechosos
 */
const detectSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /select.*from/gi,
    /drop.*table/gi,
    /union.*select/gi,
    /exec\(/gi,
    /eval\(/gi,
    /<script/gi,
    /onclick/gi
  ];

  const checkValue = (value) => {
    if (typeof value !== 'string') return false;
    return suspiciousPatterns.some(pattern => pattern.test(value));
  };

  const checkObject = (obj) => {
    if (typeof obj !== 'object') {
      return checkValue(obj);
    }
    
    return Object.values(obj).some(value => {
      if (typeof value === 'string') {
        return checkValue(value);
      }
      if (typeof value === 'object') {
        return checkObject(value);
      }
      return false;
    });
  };

  if (req.body && checkObject(req.body)) {
    console.warn(`⚠️ Suspicious activity detected from IP: ${req.ip}`);
    // No bloquear, pero loguear y monitorear
  }

  if (req.query && checkObject(req.query)) {
    console.warn(`⚠️ Suspicious query from IP: ${req.ip}`);
  }

  next();
};

/**
 * Middleware para validar método HTTP esperado
 */
const validateHttpMethod = (req, res, next) => {
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  next();
};

module.exports = {
  csrfProtection,
  jsonInjectionProtection,
  sanitizeInputs,
  validateJsonStructure,
  sanitizeUrls,
  detectSuspiciousActivity,
  validateHttpMethod,
};
