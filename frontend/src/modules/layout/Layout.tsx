import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title" onClick={() => navigate("/articles")}>
          IELTSLearning
        </div>
        <nav className="app-nav">
          <Link to="/articles" className={location.pathname.startsWith("/articles") ? "active" : ""}>
            文章
          </Link>
          <Link
            to="/vocabulary"
            className={location.pathname.startsWith("/vocabulary") ? "active" : ""}
          >
            生词本
          </Link>
          <Link
            to="/reviews/today"
            className={location.pathname.startsWith("/reviews") ? "active" : ""}
          >
            今日复习
          </Link>
          {/* 预留：统计等 */}
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

