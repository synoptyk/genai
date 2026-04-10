import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { apiClient } from '../api';

const Card = ({ title, value }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.cardValue}>{value}</Text>
  </View>
);

export default function DashboardScreen({ token, user, onLogout }) {
  const [resumen, setResumen] = useState({
    facturasPendientes: 0,
    ingresos: 0,
    egresos: 0,
    cursos: 0,
    evaluaciones: 0,
    marcasBiometricas: 0
  });

  useEffect(() => {
    const load = async () => {
      try {
        const client = apiClient(token);
        const [facturacion, tesoreria, cursos, evaluaciones, biometria] = await Promise.all([
          client.get('/empresa360/facturacion/resumen'),
          client.get('/empresa360/tesoreria/resumen'),
          client.get('/empresa360/lms/cursos'),
          client.get('/empresa360/evaluaciones'),
          client.get('/empresa360/biometria/logs')
        ]);

        setResumen({
          facturasPendientes: facturacion.data?.totalPendiente || 0,
          ingresos: tesoreria.data?.ingresos || 0,
          egresos: tesoreria.data?.egresos || 0,
          cursos: (cursos.data || []).length,
          evaluaciones: (evaluaciones.data || []).length,
          marcasBiometricas: (biometria.data || []).length
        });
      } catch {
        // Dashboard resilient: si falla un endpoint, mantiene métricas previas
      }
    };

    load();
  }, [token]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Hola, {user?.name || 'Equipo'}</Text>
      <Text style={styles.subtitle}>Panel móvil 360 de Gen AI</Text>

      <View style={styles.grid}>
        <Card title="Facturación pendiente" value={`$${resumen.facturasPendientes}`} />
        <Card title="Ingresos" value={`$${resumen.ingresos}`} />
        <Card title="Egresos" value={`$${resumen.egresos}`} />
        <Card title="Cursos activos" value={resumen.cursos} />
        <Card title="Evaluaciones" value={resumen.evaluaciones} />
        <Card title="Marcas biométricas" value={resumen.marcasBiometricas} />
      </View>

      <TouchableOpacity style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
  cardTitle: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  logout: { marginTop: 16, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#111827' },
  logoutText: { color: 'white', fontWeight: '700' }
});
