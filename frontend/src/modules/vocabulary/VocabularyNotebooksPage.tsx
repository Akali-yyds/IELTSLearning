import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyNotebook } from "./types";

// 删除确认弹窗
const DeleteConfirmModal = ({
  notebookName,
  onClose,
  onConfirm,
}: {
  notebookName: string;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="save-article-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">删除生词本</h2>
            <p className="modal-subtitle">此操作不可恢复</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>确定要删除生词本 <strong>"{notebookName}"</strong> 吗？</p>
          <p style={{ color: "#666", fontSize: "14px", marginTop: "8px" }}>
            该生词本内的单词不会被删除，但会从生词本中移除。
          </p>
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-btn"
            style={{ background: "#ef4444" }}
            onClick={onConfirm}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};

// 创建生词本弹窗
const CreateNotebookModal = ({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, note: string) => void;
}) => {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("请输入生词本名称");
      return;
    }
    setSaving(true);
    await onSave(name.trim(), note.trim());
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="save-article-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">创建生词本</h2>
            <p className="modal-subtitle">为你的生词本起个名字</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <label className="save-article-label">
            生词本名称
            <input
              type="text"
              className="title-input"
              placeholder="输入生词本名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="save-article-label">
            备注（可选）
            <textarea
              className="title-input"
              placeholder="添加备注..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button className="primary-btn" onClick={handleSave} disabled={saving}>
            {saving ? "创建中..." : "确认创建"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const VocabularyNotebooksPage = () => {
  const [notebooks, setNotebooks] = useState<VocabularyNotebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotebooks();
  }, []);

  const loadNotebooks = async () => {
    try {
      const res = await apiClient.get<VocabularyNotebook[]>("/vocabulary/notebooks");
      setNotebooks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = async (name: string, note: string) => {
    try {
      await apiClient.post("/vocabulary/notebooks", {
        name,
        note: note || undefined,
      });
      setShowCreateModal(false);
      loadNotebooks();
    } catch (err) {
      console.error(err);
      alert("创建失败");
    }
  };

  const handleDeleteNotebook = async () => {
    if (!deleteModal) return;
    setDeletingId(deleteModal.id);
    try {
      await apiClient.delete(`/vocabulary/notebooks/${deleteModal.id}`);
      setDeleteModal(null);
      loadNotebooks();
    } catch (err) {
      console.error(err);
      alert("删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="centered">加载中...</div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>我的生词本</h1>
        <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
          + 创建生词本
        </button>
      </div>

      {notebooks.length === 0 ? (
        <div className="empty-state">
          <p>还没有生词本，点击上方按钮创建你的第一个生词本</p>
          <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
            创建生词本
          </button>
        </div>
      ) : (
        <div className="card-list">
          {notebooks.map((nb) => (
            <div key={nb.id} className="notebook-card">
              <Link to={`/vocabulary/notebook/${nb.id}`} className="notebook-card-link">
                <div className="notebook-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                </div>
                <div className="notebook-card-content">
                  <div className="notebook-card-title">{nb.name}</div>
                  <div className="notebook-card-meta">
                    {nb.word_count} 个单词
                    {nb.note && ` · ${nb.note}`}
                  </div>
                </div>
              </Link>
              <button
                className="notebook-delete-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteModal({ id: nb.id, name: nb.name });
                }}
                disabled={deletingId === nb.id}
                title="删除生词本"
              >
                {deletingId === nb.id ? "..." : "×"}
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateNotebookModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateNotebook}
        />
      )}

      {deleteModal && (
        <DeleteConfirmModal
          notebookName={deleteModal.name}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDeleteNotebook}
        />
      )}
    </div>
  );
};
