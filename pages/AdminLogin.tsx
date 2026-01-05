import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!data.user) throw new Error('로그인에 실패했습니다.');

      const { data: profile, error: profileError } = await supabase
        .schema('core')
        .from('profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        setError('관리자 권한이 없습니다.');
        return;
      }

      navigate('/admin');
    } catch (err: any) {
      setError(err?.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">관리자 로그인</h1>
        <p className="text-sm text-gray-500 mb-6">관리자 계정으로 로그인해주세요.</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder=""
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder=""
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
