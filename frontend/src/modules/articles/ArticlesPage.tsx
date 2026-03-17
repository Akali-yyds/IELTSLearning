import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";

interface Article {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export const ArticlesPage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<Article[]>("/articles");
        setArticles(res.data);
      } catch (err) {
        console.error(err);
        setError("加载文章列表失败。");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = () => {
    navigate("/articles/new");
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>文章列表</h1>
        <button className="primary-btn" onClick={handleCreate}>
          新建文章
        </button>
      </div>
      {loading && <div>加载中...</div>}
      {error && <div className="error-text">{error}</div>}
      {!loading && !error && (
        <div className="card-list">
          {articles.length === 0 && <div>还没有文章，点击右上角新建一篇吧。</div>}
          {articles.map((a) => (
            <Link key={a.id} to={`/articles/${a.id}`} className="card">
              <div className="card-title">{a.title}</div>
              <div className="card-subtitle">
                创建时间：{new Date(a.created_at).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

