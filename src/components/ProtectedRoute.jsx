import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Group, Loader } from '@mantine/core';
import { getSession, onAuthStateChange } from '../lib/authService';

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    const unsubscribe = onAuthStateChange((s) => setSession(s));
    return unsubscribe;
  }, []);

  if (loading) {
    return <Group justify="center" py={80}><Loader color="brand" /></Group>;
  }

  return session ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
