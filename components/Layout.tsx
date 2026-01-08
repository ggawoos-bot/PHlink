import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [adminAccountLabel, setAdminAccountLabel] = React.useState<string>('');
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);

  const isAdminUiRoute = location.pathname.startsWith('/admin') && location.pathname !== '/admin/login';
  const showAdminAccount = isAdmin && location.pathname !== '/admin/login';

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-white font-bold bg-white/15 border border-white/20'
      : 'text-white/90 hover:text-white hover:bg-white/10 border border-transparent';

  React.useEffect(() => {
    let mounted = true;

    const setFromUser = (u: any) => {
      const label = u?.email || u?.phone || u?.id || '';
      if (mounted) setAdminAccountLabel(label);
    };

    const setFromUserAndProfile = async (u: any) => {
      setFromUser(u);
      if (!u?.id) {
        if (mounted) setIsAdmin(false);
        return;
      }
      try {
        const { data: profile, error } = await supabase
          .schema('core')
          .from('profiles')
          .select('role')
          .eq('user_id', u.id)
          .maybeSingle();
        if (error) throw error;
        if (mounted) setIsAdmin(Boolean(profile && profile.role === 'admin'));
      } catch (e) {
        console.error(e);
        if (mounted) setIsAdmin(false);
      }
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        await setFromUserAndProfile(data?.user);
      } catch (e) {
        console.error(e);
        await setFromUserAndProfile(null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setFromUserAndProfile(session?.user);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (isAdminUiRoute) navigate('/admin/login');
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50/40 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-0.5 hover:opacity-90 transition-opacity select-none">
              <span className="text-2xl font-black tracking-tighter text-white">
                PH
              </span>
              <span className="text-2xl font-black tracking-tighter text-white">
                -Link
              </span>
              <span className="w-2 h-2 rounded-full bg-white mb-3 ml-0.5"></span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-2">
                <Link to="/" className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isActive('/')}`}>자료 제출</Link>
                <Link to="/submissions" className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isActive('/submissions')}`}>제출자료 조회</Link>
                <Link to="/admin" className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 ${isActive('/admin')}`}>
                  <LayoutDashboard size={16}/> 관리자 모드
                </Link>
              </nav>

              {/* Admin account + logout (far right) */}
              {showAdminAccount && (
                <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/20">
                  <div
                    className="text-[11px] leading-none text-white/90 max-w-[220px] truncate"
                    title={adminAccountLabel || undefined}
                  >
                    {adminAccountLabel || '관리자'}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2 py-1 text-[11px] leading-none bg-white/10 text-white rounded border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              )}

              {/* Mobile account/logout + menu button */}
              <div className="flex items-center gap-2 md:hidden">
                {showAdminAccount && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2 py-1 text-[11px] leading-none bg-white/10 text-white rounded border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    로그아웃
                  </button>
                )}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 rounded-md text-white/90 hover:text-white hover:bg-white/10 focus:outline-none"
                >
                  {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/10 border-t border-white/10 backdrop-blur">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link to="/" className="block px-3 py-2 rounded-md text-base font-semibold text-white/90 hover:text-white hover:bg-white/10">자료 제출</Link>
              <Link to="/submissions" className="block px-3 py-2 rounded-md text-base font-semibold text-white/90 hover:text-white hover:bg-white/10">제출자료 조회</Link>
              <Link to="/admin" className="block px-3 py-2 rounded-md text-base font-semibold text-white/90 hover:text-white hover:bg-white/10">관리자 대시보드</Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white/70 border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
            <div className="mb-4 md:mb-0">
              <span className="font-semibold text-gray-900">PH-Link</span> &copy; 2024 자료 취합 시스템
            </div>
            <div className="flex space-x-6">
              <a href="#" className="hover:text-gray-900">개인정보처리방침</a>
              <a href="#" className="hover:text-gray-900">이용약관</a>
              <a href="#" className="hover:text-gray-900">문의하기</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;