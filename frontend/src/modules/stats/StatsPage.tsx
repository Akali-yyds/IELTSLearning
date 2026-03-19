import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { apiClient } from "../../shared/apiClient";

interface DailyReviewStat {
  date: string;
  total: number;
  unknown: number;
  vague: number;
  known: number;
}

interface StatusCounts {
  new: number;
  learning: number;
  reviewing: number;
  mastered: number;
}

interface StatsData {
  total_vocab: number;
  status_counts: StatusCounts;
  review_stats: DailyReviewStat[];
  streak_days: number;
  total_articles: number;
  total_words: number;
}

// 复习趋势图（使用 ECharts）
const ReviewTrendChart = ({
  data,
  maxReview,
  days,
}: {
  data: DailyReviewStat[];
  maxReview: number;
  days: number;
}) => {
  const stats = data.slice().reverse();

  // ECharts 配置
  const getOption = () => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      borderColor: "#334155",
      textStyle: { color: "#f1f5f9" },
      formatter: (params: any) => {
        const item = params[0];
        const stat = stats[item.dataIndex];
        return `<div style="font-size:13px">
          <div style="font-weight:600;margin-bottom:4px">${stat.date}</div>
          <div>复习次数: <span style="color:#60a5fa;font-weight:600">${stat.total}</span></div>
          <div>认识: <span style="color:#22c55e;font-weight:600">${stat.known}</span></div>
          <div>模糊: <span style="color:#f59e0b;font-weight:600">${stat.vague}</span></div>
          <div>不认识: <span style="color:#ef4444;font-weight:600">${stat.unknown}</span></div>
        </div>`;
      },
    },
    grid: {
      left: 50,
      right: 20,
      top: 30,
      bottom: 40,
    },
    xAxis: {
      type: "category",
      data: stats.map((s) => s.date.slice(5)),
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: {
        color: "#9ca3af",
        fontSize: 11,
        interval: Math.floor(stats.length / 10),
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      max: maxReview,
      splitLine: { lineStyle: { color: "#1f2937" } },
      axisLine: { show: false },
      axisLabel: { color: "#9ca3af", fontSize: 11 },
    },
    series: [
      {
        name: "复习次数",
        type: "bar",
        data: stats.map((s) => s.total),
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#3b82f6" },
              { offset: 1, color: "#60a5fa" },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: "60%",
        emphasis: {
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "#60a5fa" },
                { offset: 1, color: "#93c5fd" },
              ],
            },
          },
        },
      },
    ],
    dataZoom: days > 20 ? [
      {
        type: "slider",
        show: true,
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        borderColor: "#334155",
        backgroundColor: "#0f172a",
        fillerColor: "rgba(59, 130, 246, 0.3)",
        handleStyle: {
          color: "#3b82f6",
          borderColor: "#1e3a5f",
        },
        textStyle: { color: "#9ca3af", fontSize: 10 },
        dataBackground: {
          lineStyle: { color: "#334155" },
          areaStyle: { color: "#1f2937" },
        },
      },
    ] : undefined,
  });

  return (
    <div className="chart-wrapper">
      <ReactECharts
        option={getOption()}
        style={{ height: "200px", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
};

export const StatsPage = () => {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get<StatsData>(`/dashboard/stats?days=${days}`);
        setData(res.data);
      } catch (err) {
        console.error(err);
        setError("加载数据失败");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [days]);

  if (loading) {
    return <div className="page-container"><div className="centered">加载中...</div></div>;
  }

  if (error || !data) {
    return <div className="page-container"><div className="error-text">{error || "加载失败"}</div></div>;
  }

  const totalReviews = data.review_stats.reduce((sum, s) => sum + s.total, 0);
  const totalKnown = data.review_stats.reduce((sum, s) => sum + s.known, 0);
  const accuracy = totalReviews > 0 ? Math.round((totalKnown / totalReviews) * 100) : 0;
  const maxReview = Math.max(...data.review_stats.map(s => s.total), 1);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>学习统计</h1>
        <div className="time-range-selector">
          <button
            className={`secondary-btn ${days === 7 ? 'active' : ''}`}
            onClick={() => setDays(7)}
          >
            7 天
          </button>
          <button
            className={`secondary-btn ${days === 30 ? 'active' : ''}`}
            onClick={() => setDays(30)}
          >
            30 天
          </button>
          <button
            className={`secondary-btn ${days === 90 ? 'active' : ''}`}
            onClick={() => setDays(90)}
          >
            90 天
          </button>
        </div>
      </div>

      {/* 总览卡片 */}
      <div className="stats-overview-cards">
        <div className="stats-card">
          <div className="stats-icon vocab-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <div className="stats-info">
            <div className="stats-value">{data.total_vocab}</div>
            <div className="stats-label">生词总数</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon article-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div className="stats-info">
            <div className="stats-value">{data.total_articles}</div>
            <div className="stats-label">文章总数</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon word-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <div className="stats-info">
            <div className="stats-value">{data.total_words.toLocaleString()}</div>
            <div className="stats-label">累计词数</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon streak-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className="stats-info">
            <div className="stats-value">{data.streak_days}</div>
            <div className="stats-label">连续学习天数</div>
          </div>
        </div>
      </div>

      {/* 词汇状态分布 */}
      <div className="stats-section">
        <h2>词汇状态分布</h2>
        <div className="status-distribution">
          <div className="status-bar">
            {data.status_counts.mastered > 0 && (
              <div
                className="status-segment mastered"
                style={{ width: `${(data.status_counts.mastered / data.total_vocab) * 100}%` }}
                title={`已掌握: ${data.status_counts.mastered}`}
              />
            )}
            {data.status_counts.reviewing > 0 && (
              <div
                className="status-segment reviewing"
                style={{ width: `${(data.status_counts.reviewing / data.total_vocab) * 100}%` }}
                title={`复习中: ${data.status_counts.reviewing}`}
              />
            )}
            {data.status_counts.learning > 0 && (
              <div
                className="status-segment learning"
                style={{ width: `${(data.status_counts.learning / data.total_vocab) * 100}%` }}
                title={`学习中: ${data.status_counts.learning}`}
              />
            )}
            {data.status_counts.new > 0 && (
              <div
                className="status-segment new"
                style={{ width: `${(data.status_counts.new / data.total_vocab) * 100}%` }}
                title={`新词: ${data.status_counts.new}`}
              />
            )}
          </div>
          <div className="status-legend">
            <div className="legend-item">
              <span className="legend-dot mastered"></span>
              <span>已掌握 ({data.status_counts.mastered})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot reviewing"></span>
              <span>复习中 ({data.status_counts.reviewing})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot learning"></span>
              <span>学习中 ({data.status_counts.learning})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot new"></span>
              <span>新词 ({data.status_counts.new})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 复习趋势 */}
      <div className="stats-section stats-section-review-trend">
        <h2>复习趋势</h2>
        <div className="review-trend-stats">
          <div className="trend-stat">
            <div className="trend-value">{totalReviews}</div>
            <div className="trend-label">复习总数</div>
          </div>
          <div className="trend-stat">
            <div className="trend-value">{accuracy}%</div>
            <div className="trend-label">正确率</div>
          </div>
          <div className="trend-stat">
            <div className="trend-value">{Math.round(totalReviews / days)}</div>
            <div className="trend-label">日均复习</div>
          </div>
        </div>
        <ReviewTrendChart
          data={data.review_stats}
          maxReview={maxReview}
          days={days}
        />
      </div>
    </div>
  );
};
