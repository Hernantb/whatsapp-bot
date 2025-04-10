#!/usr/bin/env node
/**
 * Script para probar rápidamente las variables de entorno
 * y verificar si están configuradas correctamente
 */
require('dotenv').config();

// Importar el módulo env-check para verificar variables
const envCheck = require('./env-check');

console.log('\n=== PRUEBA DE VARIABLES DE ENTORNO ===\n');

// Verificar las variables de entorno sin salir del proceso
const hasAll = envCheck.verifyVars(false);

if (hasAll) {
  console.log('\n✅ Todas las variables críticas están configuradas correctamente');
  
  // Mostrar valores (parcialmente ocultos por seguridad)
  console.log('\n-- Configuración de GupShup --');
  const apiKey = process.env.GUPSHUP_API_KEY || '';
  const apiKeyDisplay = apiKey.length > 10 
    ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
    : apiKey;
  
  const userId = process.env.GUPSHUP_USERID || '';
  const userIdDisplay = userId.length > 10 
    ? `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`
    : userId;
  
  const phone = process.env.GUPSHUP_NUMBER || process.env.GUPSHUP_SOURCE_PHONE || '';
  
  console.log(`API Key: ${apiKeyDisplay}`);
  console.log(`User ID: ${userIdDisplay}`);
  console.log(`Phone: ${phone}`);
  
  console.log('\n-- Configuración de OpenAI --');
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const openaiKeyDisplay = openaiKey.length > 10 
    ? `${openaiKey.substring(0, 4)}...${openaiKey.substring(openaiKey.length - 4)}`
    : openaiKey;
  console.log(`API Key: ${openaiKeyDisplay}`);
  
  console.log('\n-- Configuración de Supabase --');
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_KEY || '';
  const supabaseKeyDisplay = supabaseKey.length > 10 
    ? `${supabaseKey.substring(0, 4)}...${supabaseKey.substring(supabaseKey.length - 4)}`
    : supabaseKey;
  
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Key: ${supabaseKeyDisplay}`);
  
  // Intentar cargar las bibliotecas necesarias para verificar que estén instaladas
  try {
    const { createClient } = require('@supabase/supabase-js');
    const OpenAI = require('openai');
    const axios = require('axios');
    const express = require('express');
    
    console.log('\n✅ Todas las bibliotecas esenciales están instaladas correctamente');
    
    // Intentar hacer una conexión básica para verificar credenciales
    console.log('\n-- Prueba de conexiones --');
    console.log('Esto puede tardar unos segundos...');
    
    // Función para probar credenciales de OpenAI
    const testOpenAI = async () => {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const models = await openai.models.list();
        console.log('✅ OpenAI: Conexión exitosa');
        return true;
      } catch (error) {
        console.error('❌ OpenAI: Error de conexión:', error.message);
        return false;
      }
    };
    
    // Función para probar credenciales de Supabase
    const testSupabase = async () => {
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        const { data, error } = await supabase.from('conversations').select('id').limit(1);
        
        if (error) throw new Error(error.message);
        console.log('✅ Supabase: Conexión exitosa');
        return true;
      } catch (error) {
        console.error('❌ Supabase: Error de conexión:', error.message);
        return false;
      }
    };
    
    // Ejecutar pruebas
    Promise.all([
      testOpenAI(),
      testSupabase()
    ]).then(results => {
      const [openaiOk, supabaseOk] = results;
      
      console.log('\n=== RESUMEN DE PRUEBAS ===');
      console.log(`OpenAI: ${openaiOk ? '✅ OK' : '❌ Error'}`);
      console.log(`Supabase: ${supabaseOk ? '✅ OK' : '❌ Error'}`);
      
      if (openaiOk && supabaseOk) {
        console.log('\n✅ TODAS LAS PRUEBAS EXITOSAS - La aplicación debería funcionar correctamente');
      } else {
        console.log('\n⚠️ ALGUNAS PRUEBAS FALLARON - Revisa los errores indicados arriba');
      }
    });
    
  } catch (error) {
    console.error('\n❌ Error al cargar bibliotecas:', error.message);
    console.error('Asegúrate de haber ejecutado "npm install" para instalar todas las dependencias');
  }
} else {
  console.log('\n❌ La prueba falló debido a variables faltantes');
  console.log('Consulta el resultado de la verificación anterior para más detalles');
}

console.log('\n=== FIN DE LA PRUEBA ===\n'); 