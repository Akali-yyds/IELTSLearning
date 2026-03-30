import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../../shared/ThemeContext";
import { useEffect, useState } from "react";

export const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/translate") return location.pathname === "/translate";
    if (path === "/vocabulary") return location.pathname.startsWith("/vocabulary");
    if (path === "/review") return location.pathname.startsWith("/review");
    if (path === "/space") return location.pathname.startsWith("/space");
    return false;
  };

  // 判断当前是否在子页面（需要显示返回按钮）
  const showBackButton = location.pathname !== "/" &&
    location.pathname !== "/translate" &&
    location.pathname !== "/vocabulary" &&
    location.pathname !== "/review" &&
    location.pathname !== "/space" &&
    location.pathname !== "/login" &&
    location.pathname !== "/register";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          {showBackButton && (
            <button className="back-btn" onClick={handleGoBack} title="返回">
              ←
            </button>
          )}
          <div className="app-title" onClick={() => navigate("/")}>
            IELTSLearning
          </div>
        </div>
        <nav className="app-nav">
          <Link to="/" className={isActive("/") ? "active" : ""}>
            首页
          </Link>
          <Link to="/translate" className={isActive("/translate") ? "active" : ""}>
            翻译
          </Link>
          <Link to="/vocabulary" className={isActive("/vocabulary") ? "active" : ""}>
            生词本
          </Link>
          <Link to="/review" className={isActive("/review") ? "active" : ""}>
            记单词
          </Link>
          <Link to="/space" className={isActive("/space") ? "active" : ""}>
            我的空间
          </Link>
        </nav>
        <div className="app-user">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <span className="app-user-email">{user?.email}</span>
          <button onClick={handleLogout} className="secondary-btn">
            退出
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};
