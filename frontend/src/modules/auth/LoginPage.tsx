import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/articles");
    } catch (err) {
      console.error(err);
      setError("登录失败，请检查邮箱和密码。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>IELTSLearning</h1>
        <h2>登录</h2>
        <form onSubmit={handleSubmit} className="form">
          <label>
            邮箱
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="auth-footer">
          还没有账号？<Link to="/register">去注册</Link>
        </div>
      </div>
    </div>
  );
};

