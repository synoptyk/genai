#!/bin/bash
# ============================================================================
# 🔐 SECURITY AUDIT HOOK - Pre-commit validation
# ============================================================================
# Este script se ejecuta antes de cada commit para validar que no se están
# subiendo secretos o credenciales expuestas.
#
# Instalación:
#   cp scripts/pre-commit-security-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
# ============================================================================

set -e

echo "🔍 Ejecutando validación de seguridad pre-commit..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
FAILED=0
WARNINGS=0

# ============================================================================
# 1. DETECTAR VARIABLES DE ENTORNO EXPUESTAS
# ============================================================================
echo ""
echo "📋 Validando variables de entorno..."

# Patrones peligrosos a buscar en archivos a hacer commit
PATTERNS=(
  "MONGODB_URI="
  "MONGO_URI="
  "JWT_SECRET="
  "GEMINI_API_KEY="
  "GROQ_API_KEY="
  "CLOUDINARY_API_SECRET="
  "SMTP_PASSWORD="
  "PASSWORD="
  "SECRET="
  "API_KEY="
  "apiKey:"
  "api_key:"
)

# Obtener archivos a hacer commit
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

for pattern in "${PATTERNS[@]}"; do
  # Buscar en archivos staged (excepto .env.example)
  if echo "$STAGED_FILES" | grep -v ".env.example" | xargs grep -l "$pattern" 2>/dev/null; then
    echo -e "${RED}❌ CRÍTICO: Posible exposición de credencial encontrada: $pattern${NC}"
    FAILED=$((FAILED + 1))
  fi
done

# ============================================================================
# 2. DETECTAR ARCHIVOS .ENV SIENDO COMMITEADOS
# ============================================================================
echo ""
echo "📋 Validando que archivos .env no sean commiteados..."

if echo "$STAGED_FILES" | grep -E "\.env(\.|$)" | grep -v ".env.example"; then
  echo -e "${RED}❌ CRÍTICO: Archivo .env está siendo commiteado${NC}"
  FAILED=$((FAILED + 1))
fi

# ============================================================================
# 3. DETECTAR KEYS DE GOOGLE, AWS, ETC
# ============================================================================
echo ""
echo "📋 Buscando credenciales de terceros..."

CREDENTIAL_PATTERNS=(
  "AIzaSy[A-Za-z0-9_-]{35}"  # Google API key
  "gsk_[A-Za-z0-9]{32,}"     # Groq API key
  "sk-[A-Za-z0-9]{48}"       # OpenAI
  "AKIAIOSFODNN7EXAMPLE"     # AWS
)

for staged_file in $STAGED_FILES; do
  [ -f "$staged_file" ] || continue
  
  for pattern in "${CREDENTIAL_PATTERNS[@]}"; do
    if grep -E "$pattern" "$staged_file" 2>/dev/null; then
      echo -e "${RED}❌ CRÍTICO: Posible credencial de tercero en $staged_file${NC}"
      FAILED=$((FAILED + 1))
    fi
  done
done

# ============================================================================
# 4. VALIDAR FORMATO DE CÓDIGO
# ============================================================================
echo ""
echo "📋 Validando sintaxis básica..."

for staged_file in $STAGED_FILES; do
  [ -f "$staged_file" ] || continue
  
  # Validar que no tenga caracteres de control
  if grep -P -q "[\x00-\x08\x0E-\x1F\x7F]" "$staged_file" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Advertencia: Caracteres de control encontrados en $staged_file${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
done

# ============================================================================
# 5. DETECTAR ARCHIVOS DEMASIADO GRANDES
# ============================================================================
echo ""
echo "📋 Validando tamaño de archivos..."

for staged_file in $STAGED_FILES; do
  [ -f "$staged_file" ] || continue
  
  size=$(wc -c < "$staged_file")
  # Alertar si archivo es mayor a 50MB
  if [ $size -gt 52428800 ]; then
    echo -e "${YELLOW}⚠️  Advertencia: Archivo muy grande ($staged_file): $(($size / 1048576))MB${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
done

# ============================================================================
# RESULTADOS
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════"

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ VALIDACIÓN FALLIDA - $FAILED errores críticos encontrados${NC}"
  echo ""
  echo "Acciones a tomar:"
  echo "  1. Revisar los archivos con exposición de credenciales"
  echo "  2. Remover las claves expuestas"
  echo "  3. Ejecutar: git reset HEAD <archivo> si fue agregado accidentalmente"
  echo "  4. Rotary todos los secretos expuestos inmediatamente"
  echo ""
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  $WARNINGS advertencias encontradas${NC}"
  echo "⏭️  Continuando con commit (solo advertencias)..."
fi

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ VALIDACIÓN EXITOSA - No se detectaron problemas de seguridad${NC}"
fi

echo "════════════════════════════════════════════════════════════════"
echo ""

exit 0
