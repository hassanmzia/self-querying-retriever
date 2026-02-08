import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  LayoutDashboard,
  Search,
  FileText,
  FolderOpen,
  Bot,
  BarChart3,
  GitBranch,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from "lucide-react";
import { useUIStore } from "../../store";

// ============================================================
// Navigation Items
// ============================================================

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/query", label: "Query", icon: Search },
  { path: "/documents", label: "Documents", icon: FileText },
  { path: "/collections", label: "Collections", icon: FolderOpen },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/pipelines", label: "Pipelines", icon: GitBranch },
  { path: "/history", label: "History", icon: History },
];

const bottomNavItems: NavItem[] = [
  { path: "/settings", label: "Settings", icon: Settings },
];

// ============================================================
// Sidebar Component
// ============================================================

export default function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, sidebarCollapsed, setSidebarOpen, setSidebarCollapsed } =
    useUIStore();

  const isCollapsed = sidebarCollapsed;

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={clsx(
          "fixed top-0 left-0 z-50 h-full flex flex-col",
          "bg-surface-900 border-r border-surface-700/50",
          "transition-all duration-300 ease-in-out",
          "lg:relative lg:z-auto",
          // Mobile: slide in/out
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Desktop: collapsed width
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo / Brand */}
        <div
          className={clsx(
            "flex items-center h-16 px-4 border-b border-surface-700/50",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-400 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <h1 className="text-sm font-bold text-surface-100 whitespace-nowrap">
                  Self-Query
                </h1>
                <p className="text-[10px] text-surface-400 whitespace-nowrap">
                  AI Retriever
                </p>
              </motion.div>
            )}
          </div>

          {/* Close button (mobile) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Collapse toggle (desktop) */}
          {!isCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="hidden lg:flex p-1 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-800"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {/* Main nav items */}
          {mainNavItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  "group relative flex items-center rounded-lg transition-all duration-200",
                  isCollapsed
                    ? "justify-center px-2 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-brand-600/10 text-brand-300 border border-brand-500/20"
                    : "text-surface-400 hover:text-surface-100 hover:bg-surface-800 border border-transparent"
                )}
              >
                <item.icon
                  className={clsx(
                    "flex-shrink-0 w-5 h-5 transition-colors",
                    isActive
                      ? "text-brand-400"
                      : "text-surface-400 group-hover:text-surface-200"
                  )}
                />

                {!isCollapsed && (
                  <span className="text-sm font-medium truncate">
                    {item.label}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand-400 rounded-r-full"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}

                {/* Badge */}
                {item.badge && !isCollapsed && (
                  <span className="ml-auto badge-brand text-[10px]">
                    {item.badge}
                  </span>
                )}

                {/* Tooltip for collapsed mode */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-surface-800 rounded-md text-sm text-surface-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-surface-700 shadow-lg">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-surface-700/50 py-4 px-3 space-y-1">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  "group relative flex items-center rounded-lg transition-all duration-200",
                  isCollapsed
                    ? "justify-center px-2 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-brand-600/10 text-brand-300 border border-brand-500/20"
                    : "text-surface-400 hover:text-surface-100 hover:bg-surface-800 border border-transparent"
                )}
              >
                <item.icon
                  className={clsx(
                    "flex-shrink-0 w-5 h-5",
                    isActive ? "text-brand-400" : "text-surface-400 group-hover:text-surface-200"
                  )}
                />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-surface-800 rounded-md text-sm text-surface-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-surface-700 shadow-lg">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}

          {/* Expand button (collapsed mode) */}
          {isCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="hidden lg:flex w-full items-center justify-center py-2.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}
