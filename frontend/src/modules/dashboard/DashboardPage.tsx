import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";

interface RecentArticle {
  id: number;
  title: string;
  word_count: number;
  updated_at: string;
}

interface DashboardData {
  total_vocab: number;
  mastered_count: number;
  pending_review: number;
  today_review_done: number;
  streak_days: number;
  recent_articles: RecentArticle[];
}

export const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get<DashboardData>("/dashboard/overview");
        setData(res.data);
      } catch (err) {
        console.error(err);
        setError("加载数据失败");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="page-container"><div className="centered">加载中...</div></div>;
  }

  if (error || !data) {
    return <div className="page-container"><div className="error-text">{error || "加载失败"}</div></div>;
  }

  const todayTotal = data.pending_review + data.today_review_done;
  const progressPercent = todayTotal > 0 ? Math.round((data.today_review_done / todayTotal) * 100) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>欢迎回来</h1>
      </div>

      {/* 快捷入口 */}
      <div className="quick-actions">
        <Link to="/translate" className="quick-action-card">
          <div className="quick-action-icon translate-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8l6 6"/>
              <path d="M4 14l6-6 2-3"/>
              <path d="M2 5h12"/>
              <path d="M7 2v3"/>
              <path d="M22 22l-5-10-5 10"/>
              <path d="M14 18h6"/>
            </svg>
          </div>
          <div className="quick-action-text">
            <div className="quick-action-title">翻译文章</div>
            <div className="quick-action-desc">粘贴英文文章获取翻译</div>
          </div>
        </Link>

        <Link to="/vocabulary" className="quick-action-card">
          <div className="quick-action-icon vocab-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <div className="quick-action-text">
            <div className="quick-action-title">生词本</div>
            <div className="quick-action-desc">查看已收藏的单词</div>
          </div>
        </Link>

        <Link to="/space" className="quick-action-card">
          <div className="quick-action-icon space-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="quick-action-text">
            <div className="quick-action-title">我的空间</div>
            <div className="quick-action-desc">复习计划与学习统计</div>
          </div>
        </Link>
      </div>

      {/* 统计概览 */}
      <div className="dashboard-overview">
        <div className="overview-item">
          <div className="overview-value">{data.total_vocab}</div>
          <div className="overview-label">生词本总量</div>
        </div>
        <div className="overview-item">
          <div className="overview-value">{data.mastered_count}</div>
          <div className="overview-label">已掌握</div>
        </div>
        <div className="overview-item">
          <div className="overview-value">{data.pending_review}</div>
          <div className="overview-label">待复习</div>
        </div>
        <div className="overview-item">
          <div className="overview-value">{data.streak_days}</div>
          <div className="overview-label">连续学习天数</div>
        </div>
      </div>

      {/* 今日进度 */}
      {data.pending_review > 0 && (
        <div className="today-progress-section">
          <div className="section-header">
            <h2>今日复习</h2>
            <Link to="/space/reviews" className="section-link">进入复习</Link>
          </div>
          <div className="progress-card">
            <div className="progress-header">
              <span className="progress-text">{data.today_review_done} / {todayTotal}</span>
              <span className="progress-percent">{progressPercent}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <Link to="/space/reviews" className="primary-btn progress-btn">
              开始复习
            </Link>
          </div>
        </div>
      )}

      {data.pending_review === 0 && data.today_review_done > 0 && (
        <div className="today-complete-section">
          <div className="complete-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>今日任务已完成！</span>
          </div>
        </div>
      )}

      {/* 最近文章 */}
      {data.recent_articles.length > 0 && (
        <div className="recent-section">
          <div className="section-header">
            <h2>最近翻译</h2>
            <Link to="/articles" className="section-link">查看全部</Link>
          </div>
          <div className="recent-list">
            {data.recent_articles.map((article) => (
              <Link
                key={article.id}
                to={`/articles/${article.id}`}
                className="recent-item"
              >
                <div className="recent-title">{article.title || "无标题"}</div>
                <div className="recent-meta">
                  <span>{article.word_count} 词</span>
                  <span>{new Date(article.updated_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
