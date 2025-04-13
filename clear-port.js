/**
 * Script auxiliar para limpiar el puerto antes de iniciar
 * Ejecutar esto antes de index.js en Render
 */

const { exec } = require('child_process');
const http = require('http');

// Puerto que usará la aplicación
const PORT = process.env.PORT || 3000;

console.log(`🔧 Comprobando disponibilidad del puerto ${PORT}...`);
