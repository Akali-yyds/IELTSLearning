import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient";

interface UserSettings {
  id: number;
  user_id: number;
  daily_review_target: number;
  created_at: string;
  updated_at: string;
}

interface AudioCacheSummary {
  cache_path: string;
  total_files: number;
  total_bytes: number;
  stale_files: number;
  stale_bytes: number;
  max_age_days: number;
  last_auto_cleanup_at: string | null;
}

interface AudioCacheCleanupResult {
  scope: "all" | "expired";
  max_age_days: number;
  deleted_files: number;
  deleted_bytes: number;
  remaining_files: number;
  remaining_bytes: number;
  cleaned_at: string;
}

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "尚未执行";
  return new Date(value).toLocaleString("zh-CN");
};

export const SettingsPage = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [cacheSummary, setCacheSummary] = useState<AudioCacheSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaningCache, setCleaningCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [dailyTarget, setDailyTarget] = useState(20);

  const loadCacheSummary = async () => {
    try {
      const res = await apiClient.get<AudioCacheSummary>("/settings/cache/audio");
      setCacheSummary(res.data);
      setCacheError(null);
    } catch (err) {
      console.error(err);
      setCacheError("缓存信息加载失败");
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, cacheRes] = await Promise.all([
          apiClient.get<UserSettings>("/settings"),
          apiClient.get<AudioCacheSummary>("/settings/cache/audio"),
        ]);
        setSettings(settingsRes.data);
        setDailyTarget(settingsRes.data.daily_review_target);
        setCacheSummary(cacheRes.data);
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

  const handleClearCache = async () => {
    setCleaningCache(true);
    setCacheError(null);
    setCacheMessage(null);
    try {
      const res = await apiClient.post<AudioCacheCleanupResult>("/settings/cache/audio/cleanup", {
        scope: "all",
      });
      setCacheMessage(
        `已清理 ${res.data.deleted_files} 个发音缓存文件，释放 ${formatBytes(res.data.deleted_bytes)}。`,
      );
      await loadCacheSummary();
    } catch (err) {
      console.error(err);
      setCacheError("清理缓存失败");
    } finally {
      setCleaningCache(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="centered">加载中...</div>
      </div>
    );
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
              每天希望复习的单词数量，系统会据此生成今日复习任务。
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
        {success && <div className="success-text">设置已保存</div>}

        <div className="setting-actions">
          <button className="primary-btn" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2>缓存管理</h2>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">发音缓存</div>
            <div className="setting-description">
              发音音频缓存保存在本地目录中。系统会在服务启动时按月自动清理 30 天前的旧音频，你也可以在这里手动一键清空。
            </div>
          </div>
          <div className="setting-control">
            <button className="secondary-btn" onClick={handleClearCache} disabled={cleaningCache}>
              {cleaningCache ? "清理中..." : "清理缓存"}
            </button>
          </div>
        </div>

        {cacheSummary && (
          <div className="cache-summary-grid">
            <div className="cache-summary-card">
              <div className="cache-summary-label">当前缓存文件</div>
              <div className="cache-summary-value">{cacheSummary.total_files}</div>
              <div className="cache-summary-meta">{formatBytes(cacheSummary.total_bytes)}</div>
            </div>
            <div className="cache-summary-card">
              <div className="cache-summary-label">{cacheSummary.max_age_days} 天前旧缓存</div>
              <div className="cache-summary-value">{cacheSummary.stale_files}</div>
              <div className="cache-summary-meta">{formatBytes(cacheSummary.stale_bytes)}</div>
            </div>
            <div className="cache-summary-card">
              <div className="cache-summary-label">上次自动清理</div>
              <div className="cache-summary-value cache-summary-small">
                {formatDateTime(cacheSummary.last_auto_cleanup_at)}
              </div>
              <div className="cache-summary-meta">目录：{cacheSummary.cache_path}</div>
            </div>
          </div>
        )}

        {cacheError && <div className="error-text">{cacheError}</div>}
        {cacheMessage && <div className="success-text">{cacheMessage}</div>}
      </div>

      <div className="settings-section">
        <h2>建议继续放进设置里的功能</h2>
        <div className="settings-hint-list">
          <div className="settings-hint-item">发音偏好：默认优先英式或美式发音。</div>
          <div className="settings-hint-item">查词行为：默认例句数量、是否自动加载发音。</div>
          <div className="settings-hint-item">默认词书：添加生词时默认选中的词书。</div>
          <div className="settings-hint-item">数据管理：导出词书、导出文章、手动清理孤儿数据。</div>
          <div className="settings-hint-item">阅读偏好：字体大小、文章编辑页的显示宽度。</div>
        </div>
      </div>

      <div className="settings-section">
        <h2>关于</h2>
        <div className="about-info">
          <p>IELTSLearning - 英语学习助手</p>
          <p className="version">版本 1.0.0</p>
          {settings && <p className="version">最近更新：{new Date(settings.updated_at).toLocaleString("zh-CN")}</p>}
        </div>
      </div>
    </div>
  );
};
