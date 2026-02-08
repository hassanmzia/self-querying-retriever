import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  Menu,
  Search,
  Bell,
  Settings,
  X,
  Check,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUIStore } from "../../store";

// ============================================================
// Page Title Map
// ============================================================

const pageTitles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Dashboard",
    description: "System overview and key metrics",
  },
  "/query": {
    title: "Query Interface",
    description: "Search documents using multiple retrieval methods",
  },
  "/documents": {
    title: "Documents",
    description: "Manage and browse indexed documents",
  },
  "/collections": {
    title: "Collections",
    description: "Organize documents into collections",
  },
  "/agents": {
    title: "Agent Visualization",
    description: "Monitor LangGraph multi-agent execution",
  },
  "/analytics": {
    title: "Analytics",
    description: "Query performance and usage analytics",
  },
  "/pipelines": {
    title: "Pipeline Configuration",
    description: "Configure retrieval and augmentation pipelines",
  },
  "/history": {
    title: "Query History",
    description: "Browse past queries and results",
  },
  "/settings": {
    title: "Settings",
    description: "Application configuration and preferences",
  },
};

// ============================================================
// Header Component
// ============================================================

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    setSidebarOpen,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    globalSearchOpen,
    setGlobalSearchOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
  } = useUIStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get current page info
  const currentPage = pageTitles[location.pathname] ?? {
    title: "Page",
    description: "",
  };

  // Close notifications on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (globalSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [globalSearchOpen]);

  // Keyboard shortcut for search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
      }
      if (event.key === "Escape") {
        setGlobalSearchOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (globalSearchQuery.trim()) {
        navigate(`/query?q=${encodeURIComponent(globalSearchQuery.trim())}`);
        setGlobalSearchOpen(false);
        setGlobalSearchQuery("");
      }
    },
    [globalSearchQuery, navigate, setGlobalSearchOpen, setGlobalSearchQuery]
  );

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 lg:px-6 bg-surface-900/80 backdrop-blur-xl border-b border-surface-700/50">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page title */}
        <div>
          <h2 className="text-lg font-semibold text-surface-100">
            {currentPage.title}
          </h2>
          {currentPage.description && (
            <p className="text-xs text-surface-400 hidden sm:block">
              {currentPage.description}
            </p>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Search toggle */}
        <button
          onClick={() => setGlobalSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700/50 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-surface-500 bg-surface-900 rounded border border-surface-700">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden rounded-xl bg-surface-800 border border-surface-700 shadow-xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
                  <h3 className="text-sm font-semibold text-surface-100">
                    Notifications
                  </h3>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllNotificationsRead()}
                        className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700"
                        title="Mark all as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={() => clearNotifications()}
                        className="p-1 rounded text-surface-400 hover:text-red-400 hover:bg-surface-700"
                        title="Clear all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications list */}
                <div className="overflow-y-auto max-h-72">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-surface-500">
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => markNotificationRead(notification.id)}
                        className={clsx(
                          "w-full text-left px-4 py-3 border-b border-surface-700/50 hover:bg-surface-700/50 transition-colors",
                          !notification.read && "bg-brand-600/5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={clsx(
                              "mt-1 w-2 h-2 rounded-full flex-shrink-0",
                              notification.type === "info" && "bg-blue-400",
                              notification.type === "success" &&
                                "bg-emerald-400",
                              notification.type === "warning" &&
                                "bg-amber-400",
                              notification.type === "error" && "bg-red-400"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-surface-200 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-surface-400 line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-surface-500 mt-1">
                              {formatDistanceToNow(
                                new Date(notification.timestamp),
                                { addSuffix: true }
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings quick access */}
        <button
          onClick={() => navigate("/settings")}
          className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Global search overlay */}
      <AnimatePresence>
        {globalSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
            onClick={() => setGlobalSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    placeholder="Search documents, queries, collections..."
                    className="w-full pl-12 pr-12 py-4 bg-surface-800 border border-surface-600 rounded-xl text-surface-100 text-lg placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 shadow-2xl"
                  />
                  <button
                    type="button"
                    onClick={() => setGlobalSearchOpen(false)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded text-surface-400 hover:text-surface-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="mt-2 text-center text-xs text-surface-500">
                Press <kbd className="px-1 py-0.5 bg-surface-800 rounded border border-surface-700 font-mono">Enter</kbd> to search
                {" "} or <kbd className="px-1 py-0.5 bg-surface-800 rounded border border-surface-700 font-mono">Esc</kbd> to close
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
