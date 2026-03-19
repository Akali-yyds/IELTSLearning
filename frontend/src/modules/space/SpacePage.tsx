import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";

interface DashboardData {
  total_vocab: number;
  mastered_count: number;
  pending_review: number;
  today_review_done: number;
  streak_days: number;
}

export const SpacePage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get<DashboardData>("/dashboard/overview");
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="page-container"><div className="centered">加载中...</div></div>;
  }

  const todayTotal = data ? data.pending_review + data.today_review_done : 0;
  const progressPercent = todayTotal > 0 && data ? Math.round((data.today_review_done / todayTotal) * 100) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>我的空间</h1>
      </div>

      {/* 我的文章和我的生词本入口 */}
      <div className="space-section space-quick-access">
        <div className="quick-access-grid">
          <Link to="/articles" className="quick-access-item">
            <div className="quick-access-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div className="quick-access-text">
              <div className="quick-access-title">我的文章</div>
              <div className="quick-access-desc">查看已保存的文章</div>
            </div>
          </Link>
          <Link to="/vocabulary" className="quick-access-item">
            <div className="quick-access-icon vocab-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div className="quick-access-text">
              <div className="quick-access-title">我的生词本</div>
              <div className="quick-access-desc">管理你的生词库</div>
            </div>
          </Link>
        </div>
      </div>

      {/* 今日复习进度 */}
      <div className="space-section">
        <h2>今日复习</h2>
        {data && data.pending_review > 0 ? (
          <div className="review-progress-card">
            <div className="progress-info">
              <div className="progress-numbers">
                <span className="done">{data.today_review_done}</span>
                <span className="separator">/</span>
                <span className="total">{todayTotal}</span>
              </div>
              <div className="progress-label">今日进度</div>
            </div>
            <div className="progress-circle">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${progressPercent}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="percent">{progressPercent}%</span>
            </div>
            <Link to="/space/reviews" className="primary-btn start-review-btn">
              开始复习
            </Link>
          </div>
        ) : (
          <div className="review-complete-card">
            <div className="complete-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="complete-text">
              {data && data.today_review_done > 0 ? "今日任务已完成！" : "今日暂无复习任务"}
            </div>
            {data && data.streak_days > 0 && (
              <div className="streak-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                连续学习 {data.streak_days} 天
              </div>
            )}
          </div>
        )}
      </div>

      {/* 学习统计入口 */}
      <div className="space-section">
        <h2>学习统计</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{data?.total_vocab || 0}</div>
            <div className="stat-label">生词总数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data?.mastered_count || 0}</div>
            <div className="stat-label">已掌握</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data?.pending_review || 0}</div>
            <div className="stat-label">待复习</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data?.streak_days || 0}</div>
            <div className="stat-label">连续天数</div>
          </div>
        </div>
        <Link to="/space/stats" className="secondary-btn view-stats-btn">
          查看详细统计
        </Link>
      </div>

      {/* 快捷功能 */}
      <div className="space-section">
        <h2>快捷功能</h2>
        <div className="quick-links">
          <Link to="/space/settings" className="quick-link-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>设置</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
