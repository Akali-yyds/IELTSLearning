import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useEffect, useState } from "react";

export const Layout = () => {
  const { user, logout } = useAuth();
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
