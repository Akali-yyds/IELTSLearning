import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("两次密码输入不一致。");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(email, password);
      navigate("/articles");
    } catch (err) {
      console.error(err);
      setError("注册失败，邮箱可能已被使用。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>IELTSLearning</h1>
        <h2>注册</h2>
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
          <label>
            确认密码
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "注册中..." : "注册并登录"}
          </button>
        </form>
        <div className="auth-footer">
          已有账号？<Link to="/login">去登录</Link>
        </div>
      </div>
    </div>
  );
};

