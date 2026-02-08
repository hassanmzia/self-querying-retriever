import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { Loader2 } from "lucide-react";

// ============================================================
// Lazy-loaded page components
// ============================================================

const Dashboard = lazy(() => import("./pages/Dashboard"));
const QueryInterface = lazy(() => import("./pages/QueryInterface"));
const Documents = lazy(() => import("./pages/Documents"));
const Collections = lazy(() => import("./pages/Collections"));
const AgentVisualization = lazy(() => import("./pages/AgentVisualization"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Pipelines = lazy(() => import("./pages/Pipelines"));
const QueryHistory = lazy(() => import("./pages/QueryHistory"));
const Settings = lazy(() => import("./pages/Settings"));

// ============================================================
// Loading Fallback
// ============================================================

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-sm text-surface-500">Loading...</p>
      </div>
    </div>
  );
}

// ============================================================
// App Component
// ============================================================

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="query"
          element={
            <Suspense fallback={<PageLoader />}>
              <QueryInterface />
            </Suspense>
          }
        />
        <Route
          path="documents"
          element={
            <Suspense fallback={<PageLoader />}>
              <Documents />
            </Suspense>
          }
        />
        <Route
          path="collections"
          element={
            <Suspense fallback={<PageLoader />}>
              <Collections />
            </Suspense>
          }
        />
        <Route
          path="agents"
          element={
            <Suspense fallback={<PageLoader />}>
              <AgentVisualization />
            </Suspense>
          }
        />
        <Route
          path="analytics"
          element={
            <Suspense fallback={<PageLoader />}>
              <Analytics />
            </Suspense>
          }
        />
        <Route
          path="pipelines"
          element={
            <Suspense fallback={<PageLoader />}>
              <Pipelines />
            </Suspense>
          }
        />
        <Route
          path="history"
          element={
            <Suspense fallback={<PageLoader />}>
              <QueryHistory />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          }
        />
        {/* Catch-all 404 */}
        <Route
          path="*"
          element={
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <h2 className="text-4xl font-bold text-surface-300">404</h2>
              <p className="mt-2 text-surface-500">Page not found</p>
              <a href="/" className="mt-4 btn-primary text-sm">
                Go to Dashboard
              </a>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
