import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./modules/auth/LoginPage";
import { RegisterPage } from "./modules/auth/RegisterPage";
import { ArticlesPage } from "./modules/articles/ArticlesPage";
import { ArticleEditPage } from "./modules/articles/ArticleEditPage";
import { useAuth } from "./modules/auth/AuthContext";
import { Layout } from "./modules/layout/Layout";
import { VocabularyListPage } from "./modules/vocabulary/VocabularyListPage";
import { VocabularyNotebooksPage } from "./modules/vocabulary/VocabularyNotebooksPage";
import { VocabularyDetailPage } from "./modules/vocabulary/VocabularyDetailPage";
import { ReviewPage } from "./modules/review/ReviewPage";
import { TodayReviewPage } from "./modules/reviews/TodayReviewPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { StatsPage } from "./modules/stats/StatsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { TranslatePage } from "./modules/translate/TranslatePage";
import { SpacePage } from "./modules/space/SpacePage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="translate" element={<TranslatePage />} />
        <Route path="articles" element={<ArticlesPage />} />
        <Route path="articles/new" element={<ArticleEditPage />} />
        <Route path="articles/:id" element={<ArticleEditPage />} />
        <Route path="vocabulary" element={<VocabularyNotebooksPage />} />
        <Route path="vocabulary/notebook/:notebookId" element={<VocabularyListPage />} />
        <Route path="vocabulary/:id" element={<VocabularyDetailPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="review/:notebookId" element={<ReviewPage />} />
        <Route path="space" element={<SpacePage />} />
        <Route path="space/reviews" element={<TodayReviewPage />} />
        <Route path="space/stats" element={<StatsPage />} />
        <Route path="space/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
