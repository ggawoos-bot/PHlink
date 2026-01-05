import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Admin from './pages/Admin';
import SurveyCreate from './pages/SurveyCreate';
import SurveyList from './pages/SurveyList';
import SurveySubmit from './pages/SurveySubmit';
import AdminLogin from './pages/AdminLogin';
import Statistics from './pages/Statistics';
import { supabase } from './services/supabaseClient';

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) {
        if (mounted) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .schema('core')
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (mounted) {
        setIsAdmin(Boolean(profile && profile.role === 'admin'));
        setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<SurveyList />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="/admin/statistics" element={<RequireAdmin><Statistics /></RequireAdmin>} />
          <Route path="/admin/survey/create" element={<RequireAdmin><SurveyCreate /></RequireAdmin>} />
          <Route path="/admin/survey/edit/:id" element={<RequireAdmin><SurveyCreate /></RequireAdmin>} />
          <Route path="/surveys" element={<SurveyList />} />
          <Route path="/surveys/submit/:id" element={<SurveySubmit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;