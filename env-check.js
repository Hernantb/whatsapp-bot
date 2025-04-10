#!/usr/bin/env node
/**
 * Script para verificar las variables de entorno necesarias
 * para el funcionamiento del bot de WhatsApp
 */
require('dotenv').config();

// Colores para la consola
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

console.log(`${COLORS.cyan}=== VERIFICACIÓN DE VARIABLES DE ENTORNO ===${COLORS.reset}\n`);

// Lista de variables de entorno críticas
const criticalVars = [
  'GUPSHUP_API_KEY',
  'GUPSHUP_NUMBER',
  'GUPSHUP_USERID',
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_KEY',
];

// Otras variables recomendadas
const recommendedVars = [
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'NOTIFICATION_EMAIL',
  'PORT'
];

// Verificar variables críticas
let missingCriticalVars = [];
let missingRecommendedVars = [];

console.log(`${COLORS.blue}Variables críticas:${COLORS.reset}`);
for (const varName of criticalVars) {
  if (process.env[varName]) {
    // Mostrar sólo primeros 8 caracteres para seguridad
    const value = process.env[varName];
    const displayValue = value.length > 10 
      ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
      : value;
    console.log(`${COLORS.green}✓ ${varName}${COLORS.reset}: ${displayValue}`);
  } else {
    console.log(`${COLORS.red}✗ ${varName}${COLORS.reset}: NO CONFIGURADA`);
    missingCriticalVars.push(varName);
  }
}

console.log(`\n${COLORS.blue}Variables recomendadas:${COLORS.reset}`);
for (const varName of recommendedVars) {
  if (process.env[varName]) {
    const value = process.env[varName];
    // No mostrar contraseñas
    const displayValue = varName.includes('PASSWORD') ? '********' : value;
    console.log(`${COLORS.green}✓ ${varName}${COLORS.reset}: ${displayValue}`);
  } else {
    console.log(`${COLORS.yellow}⚠ ${varName}${COLORS.reset}: NO CONFIGURADA`);
    missingRecommendedVars.push(varName);
  }
}

console.log("\n");

// Imprimir resumen
if (missingCriticalVars.length > 0) {
  console.log(`${COLORS.red}*** ADVERTENCIA: FALTAN VARIABLES CRÍTICAS ***${COLORS.reset}`);
  console.log(`Las siguientes variables críticas no están configuradas:`);
  missingCriticalVars.forEach(v => console.log(`${COLORS.red}  - ${v}${COLORS.reset}`));
  
  // Valores de ejemplo para Gupshup
  console.log(`\n${COLORS.yellow}Valores de ejemplo para Gupshup:${COLORS.reset}`);
  console.log(`- GUPSHUP_API_KEY: sk_abcde123456789012345678901234567`);
  console.log(`- GUPSHUP_NUMBER: 15557033313`);
  console.log(`- GUPSHUP_USERID: abcdef123456abcdef123456abcdef12`);
  
  // Instrucciones para configurar en Render
  console.log(`\n${COLORS.cyan}Para configurar estas variables en Render:${COLORS.reset}`);
  console.log(`1. Ve a tu dashboard de Render: https://dashboard.render.com/`);
  console.log(`2. Selecciona tu servicio web "whatsapp-bot"`);
  console.log(`3. Ve a la pestaña "Environment"`);
  console.log(`4. Agrega cada variable y su valor`);
  console.log(`5. Haz clic en "Save Changes" y luego en "Manual Deploy" > "Clear build cache & deploy"`);
  
  process.exit(1);
} else {
  console.log(`${COLORS.green}✅ Todas las variables críticas están configuradas correctamente${COLORS.reset}`);
  
  if (missingRecommendedVars.length > 0) {
    console.log(`${COLORS.yellow}⚠️ Faltan algunas variables recomendadas:${COLORS.reset}`);
    missingRecommendedVars.forEach(v => console.log(`${COLORS.yellow}  - ${v}${COLORS.reset}`));
  }
}

// Verificar que las variables de GupShup estén correctamente formateadas
console.log(`\n${COLORS.blue}Verificación de formato:${COLORS.reset}`);

const gupshupKey = process.env.GUPSHUP_API_KEY || '';
if (gupshupKey && !gupshupKey.startsWith('sk_')) {
  console.log(`${COLORS.red}⚠️ GUPSHUP_API_KEY no tiene el formato correcto (debería comenzar con 'sk_')${COLORS.reset}`);
}

const gupshupNumber = process.env.GUPSHUP_NUMBER || '';
if (gupshupNumber && !/^\d+$/.test(gupshupNumber)) {
  console.log(`${COLORS.red}⚠️ GUPSHUP_NUMBER debe contener solo dígitos${COLORS.reset}`);
}

console.log(`\n${COLORS.cyan}=== FIN DE LA VERIFICACIÓN ===${COLORS.reset}`);

// Exportar las variables para uso en scripts
module.exports = {
  hasCriticalVars: missingCriticalVars.length === 0,
  hasRecommendedVars: missingRecommendedVars.length === 0,
  missingCriticalVars,
  missingRecommendedVars,
  verifyVars: function(exitOnError = true) {
    if (missingCriticalVars.length > 0) {
      console.error('🛑 ERROR CRÍTICO: FALTAN VARIABLES DE ENTORNO NECESARIAS 🛑');
      console.error('Las siguientes variables no están configuradas:');
      missingCriticalVars.forEach(v => console.error(`  - ${v}`));
      console.error('\nEl bot NO PUEDE FUNCIONAR sin estas variables. Por favor, configúralas antes de iniciar.');
      
      if (exitOnError) {
        process.exit(1);
      }
      return false;
    }
    return true;
  }
}; 