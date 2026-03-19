import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient";

interface UserSettings {
  id: number;
  user_id: number;
  daily_review_target: number;
  created_at: string;
  updated_at: string;
}

export const SettingsPage = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [dailyTarget, setDailyTarget] = useState(20);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiClient.get<UserSettings>("/settings");
        setSettings(res.data);
        setDailyTarget(res.data.daily_review_target);
      } catch (err) {
        console.error(err);
        setError("加载设置失败");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await apiClient.put<UserSettings>("/settings", {
        daily_review_target: dailyTarget,
      });
      setSettings(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("保存设置失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="centered">加载中...</div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>设置</h1>
      </div>

      <div className="settings-section">
        <h2>学习设置</h2>
        
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">每日复习目标</div>
            <div className="setting-description">
              每天希望复习的单词数量，系统会根据此目标生成每日复习任务
            </div>
          </div>
          <div className="setting-control">
            <select
              value={dailyTarget}
              onChange={(e) => setDailyTarget(Number(e.target.value))}
              className="setting-select"
            >
              <option value={5}>5 个单词</option>
              <option value={10}>10 个单词</option>
              <option value={15}>15 个单词</option>
              <option value={20}>20 个单词</option>
              <option value={30}>30 个单词</option>
              <option value={50}>50 个单词</option>
              <option value={100}>100 个单词</option>
            </select>
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}
        
        {success && (
          <div className="success-text">设置已保存</div>
        )}

        <div className="setting-actions">
          <button 
            className="primary-btn" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2>关于</h2>
        <div className="about-info">
          <p>IELTSLearning - 英语学习助手</p>
          <p className="version">版本 1.0.0</p>
        </div>
      </div>
    </div>
  );
};
