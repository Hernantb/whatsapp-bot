/**
 * Script para verificar si el DNS de Supabase es accesible
 */
const dns = require('dns');
const SUPABASE_HOST = 'ecnimzwygbbumxdcilsb.supabase.co';

console.log(`🔍 Verificando acceso DNS a: ${SUPABASE_HOST}`);

// Verificar resolución de DNS
dns.lookup(SUPABASE_HOST, (err, address, family) => {
  if (err) {
    console.error('❌ ERROR: No se pudo resolver el DNS de Supabase');
    console.error('❌ Mensaje de error:', err.message);
    console.error('❌ Código de error:', err.code);
    
    // Mostrar info de red
    try {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      
      console.log('\n📡 Interfaces de red:');
      Object.keys(networkInterfaces).forEach(ifaceName => {
        console.log(`   Interface: ${ifaceName}`);
        networkInterfaces[ifaceName].forEach(iface => {
          if (iface.family === 'IPv4' || iface.family === 4) {
            console.log(`      IPv4: ${iface.address}`);
          }
        });
      });
      
      // Probar DNS alternativos
      console.log('\n🔍 Probando servidores DNS alternativos...');
      
      // Cloudflare DNS
      dns.setServers(['1.1.1.1', '1.0.0.1']);
      console.log('   Usando DNS de Cloudflare (1.1.1.1)');
      
      dns.lookup(SUPABASE_HOST, (err2, address2) => {
        if (err2) {
          console.error('   ❌ DNS de Cloudflare falló:', err2.message);
          
          // Google DNS
          dns.setServers(['8.8.8.8', '8.8.4.4']);
          console.log('   Usando DNS de Google (8.8.8.8)');
          
          dns.lookup(SUPABASE_HOST, (err3, address3) => {
            if (err3) {
              console.error('   ❌ DNS de Google falló:', err3.message);
              console.error('\n❌ PROBLEMA CRÍTICO: No se puede resolver Supabase con ningún proveedor DNS');
              console.error('❌ Esto sugiere un problema de conectividad a internet o bloqueo DNS específico');
            } else {
              console.log(`   ✅ Google DNS pudo resolver Supabase: ${address3}`);
              console.log('\n✅ SOLUCIÓN: Usa Google DNS (8.8.8.8, 8.8.4.4) en este servidor');
            }
          });
        } else {
          console.log(`   ✅ Cloudflare DNS pudo resolver Supabase: ${address2}`);
          console.log('\n✅ SOLUCIÓN: Usa Cloudflare DNS (1.1.1.1, 1.0.0.1) en este servidor');
        }
      });
    } catch (error) {
      console.error('❌ Error obteniendo información de red:', error.message);
    }
  } else {
    console.log(`✅ Supabase DNS resuelto correctamente: ${address} (IPv${family})`);
    console.log('✅ El servidor puede acceder a Supabase correctamente');
    
    // Verificar conectividad HTTP
    console.log('\n🔍 Verificando conectividad HTTP...');
    const axios = require('axios');
    
    axios.get(`https://${SUPABASE_HOST}/rest/v1/health`, {
      timeout: 5000,
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbmltend5Z2JidW14ZGNpbHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDM3MTkxMTEsImV4cCI6MjAxOTI5NTExMX0.KGnGBMq0nEG6BRE2CojwhqiOIzvgEvbQ-eKlnQrIaGs'
      }
    })
    .then(response => {
      console.log(`✅ Conexión HTTP exitosa: código ${response.status}`);
      console.log('✅ Supabase está completamente accesible desde este servidor');
    })
    .catch(error => {
      console.error('❌ Error de conexión HTTP:', error.message);
      if (error.response) {
        console.log(`   Respuesta del servidor: ${error.response.status}`);
      } else if (error.code) {
        console.log(`   Código de error: ${error.code}`);
      }
    });
  }
}); 