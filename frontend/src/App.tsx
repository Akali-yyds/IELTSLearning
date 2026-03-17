import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./modules/auth/LoginPage";
import { RegisterPage } from "./modules/auth/RegisterPage";
import { ArticlesPage } from "./modules/articles/ArticlesPage";
import { ArticleEditPage } from "./modules/articles/ArticleEditPage";
import { useAuth } from "./modules/auth/AuthContext";
import { Layout } from "./modules/layout/Layout";
import { VocabularyListPage } from "./modules/vocabulary/VocabularyListPage";
import { VocabularyDetailPage } from "./modules/vocabulary/VocabularyDetailPage";
import { TodayReviewPage } from "./modules/reviews/TodayReviewPage";

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
        <Route index element={<Navigate to="/articles" replace />} />
        <Route path="articles" element={<ArticlesPage />} />
        <Route path="articles/new" element={<ArticleEditPage />} />
        <Route path="articles/:id" element={<ArticleEditPage />} />
        <Route path="vocabulary" element={<VocabularyListPage />} />
        <Route path="vocabulary/:id" element={<VocabularyDetailPage />} />
        <Route path="reviews/today" element={<TodayReviewPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

