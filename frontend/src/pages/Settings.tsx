import { useState } from "react";
import {
  Save,
  Key,
  Globe,
  Cpu,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  Server,
  Activity,
  Palette,
  Sliders,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { useQueryStore, useUIStore } from "@/store";
import Badge from "@/components/common/Badge";
import { RetrievalMethod } from "@/types";

// ============================================================
// Settings Page
// ============================================================

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function SettingsSection({ title, description, icon, children }: SettingsSectionProps) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
      <div className="border-b border-slate-700/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleField({ label, description, enabled, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={clsx(
          "relative h-5 w-9 rounded-full transition-colors",
          enabled ? "bg-teal-500" : "bg-slate-600"
        )}
      >
        <div
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

export default function Settings() {
  // Store values
  const queryStore = useQueryStore();
  const uiStore = useUIStore();

  // API Configuration
  const [apiBaseUrl, setApiBaseUrl] = useState("http://172.168.1.95:3087");
  const [wsUrl, setWsUrl] = useState("ws://172.168.1.95:3087/ws");

  // API Keys (masked)
  const [openaiKey, setOpenaiKey] = useState("");
  const [langsmithKey, setLangsmithKey] = useState("");
  const [langfusePublicKey, setLangfusePublicKey] = useState("");
  const [langfuseSecretKey, setLangfuseSecretKey] = useState("");

  // Key visibility
  const [showOpenai, setShowOpenai] = useState(false);
  const [showLangsmith, setShowLangsmith] = useState(false);
  const [showLangfusePublic, setShowLangfusePublic] = useState(false);
  const [showLangfuseSecret, setShowLangfuseSecret] = useState(false);

  // LangSmith / LangFuse settings
  const [langsmithProject, setLangsmithProject] = useState("self-querying-retriever");
  const [langsmithEnabled, setLangsmithEnabled] = useState(false);
  const [langfuseEnabled, setLangfuseEnabled] = useState(false);
  const [langfuseHost, setLangfuseHost] = useState("https://cloud.langfuse.com");

  // Feature toggles
  const [enableStreaming, setEnableStreaming] = useState(true);
  const [enableAgentTraces, setEnableAgentTraces] = useState(true);
  const [enableCaching, setEnableCaching] = useState(true);
  const [enableAnalytics, setEnableAnalytics] = useState(true);

  // Defaults
  const [defaultMethod, setDefaultMethod] = useState<RetrievalMethod>(queryStore.retrievalMethod);
  const [defaultTopK, setDefaultTopK] = useState(queryStore.topK);
  const [defaultScoreThreshold, setDefaultScoreThreshold] = useState(queryStore.scoreThreshold);

  // Saving
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Persist defaults to store
      queryStore.setRetrievalMethod(defaultMethod);
      queryStore.setTopK(defaultTopK);
      queryStore.setScoreThreshold(defaultScoreThreshold);

      // Simulate API call to save server-side settings
      await new Promise((resolve) => setTimeout(resolve, 800));

      setLastSaved(new Date());
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setApiBaseUrl("http://172.168.1.95:3087");
    setWsUrl("ws://172.168.1.95:3087/ws");
    setDefaultMethod(RetrievalMethod.HYBRID);
    setDefaultTopK(10);
    setDefaultScoreThreshold(0.5);
    setEnableStreaming(true);
    setEnableAgentTraces(true);
    setEnableCaching(true);
    setEnableAnalytics(true);
    toast.success("Settings reset to defaults");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure your retrieval system and integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Saved {lastSaved.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isSaving
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/20"
            )}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* API Configuration */}
      <SettingsSection
        title="API Configuration"
        description="Base URL and WebSocket connection settings"
        icon={<Server className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-300">API Base URL</label>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">WebSocket URL</label>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 font-mono"
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* API Keys */}
      <SettingsSection
        title="API Keys"
        description="Manage your API keys for external services"
        icon={<Key className="h-4 w-4" />}
      >
        <div className="space-y-4">
          {/* OpenAI */}
          <div>
            <label className="mb-1 block text-sm text-slate-300">OpenAI API Key</label>
            <div className="relative">
              <input
                type={showOpenai ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 font-mono"
              />
              <button
                onClick={() => setShowOpenai(!showOpenai)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
              >
                {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* LangSmith */}
      <SettingsSection
        title="LangSmith Integration"
        description="Tracing and debugging with LangSmith"
        icon={<Activity className="h-4 w-4" />}
      >
        <ToggleField
          label="Enable LangSmith"
          description="Send trace data to LangSmith for debugging and monitoring"
          enabled={langsmithEnabled}
          onChange={setLangsmithEnabled}
        />
        {langsmithEnabled && (
          <div className="space-y-4 pl-0">
            <div>
              <label className="mb-1 block text-sm text-slate-300">LangSmith API Key</label>
              <div className="relative">
                <input
                  type={showLangsmith ? "text" : "password"}
                  value={langsmithKey}
                  onChange={(e) => setLangsmithKey(e.target.value)}
                  placeholder="ls-..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 font-mono"
                />
                <button
                  onClick={() => setShowLangsmith(!showLangsmith)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                >
                  {showLangsmith ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Project Name</label>
              <input
                type="text"
                value={langsmithProject}
                onChange={(e) => setLangsmithProject(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
              />
            </div>
          </div>
        )}
      </SettingsSection>

      {/* LangFuse */}
      <SettingsSection
        title="LangFuse Integration"
        description="Observability and analytics with LangFuse"
        icon={<Activity className="h-4 w-4" />}
      >
        <ToggleField
          label="Enable LangFuse"
          description="Send observability data to LangFuse for analytics"
          enabled={langfuseEnabled}
          onChange={setLangfuseEnabled}
        />
        {langfuseEnabled && (
          <div className="space-y-4 pl-0">
            <div>
              <label className="mb-1 block text-sm text-slate-300">LangFuse Host</label>
              <input
                type="text"
                value={langfuseHost}
                onChange={(e) => setLangfuseHost(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Public Key</label>
              <div className="relative">
                <input
                  type={showLangfusePublic ? "text" : "password"}
                  value={langfusePublicKey}
                  onChange={(e) => setLangfusePublicKey(e.target.value)}
                  placeholder="pk-lf-..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 font-mono"
                />
                <button
                  onClick={() => setShowLangfusePublic(!showLangfusePublic)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                >
                  {showLangfusePublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Secret Key</label>
              <div className="relative">
                <input
                  type={showLangfuseSecret ? "text" : "password"}
                  value={langfuseSecretKey}
                  onChange={(e) => setLangfuseSecretKey(e.target.value)}
                  placeholder="sk-lf-..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 font-mono"
                />
                <button
                  onClick={() => setShowLangfuseSecret(!showLangfuseSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                >
                  {showLangfuseSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* Default Query Settings */}
      <SettingsSection
        title="Default Query Settings"
        description="Default configuration for new queries"
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="space-y-5">
          {/* Default method */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">Default Retrieval Method</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                  { value: RetrievalMethod.VECTOR, label: "Vector" },
                  { value: RetrievalMethod.SELF_QUERY, label: "Self-Query" },
                  { value: RetrievalMethod.BM25, label: "BM25" },
                  { value: RetrievalMethod.HYBRID, label: "Hybrid" },
                  { value: RetrievalMethod.HYPOTHETICAL, label: "Hypothetical" },
                ].map((method) => (
                <button
                  key={method.value}
                  onClick={() => setDefaultMethod(method.value)}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    defaultMethod === method.value
                      ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  )}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top K */}
          <div>
            <label className="mb-2 flex items-center justify-between text-sm text-slate-300">
              <span>Default Top K</span>
              <span className="rounded bg-slate-700 px-2 py-0.5 text-xs tabular-nums text-teal-400">
                {defaultTopK}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={defaultTopK}
              onChange={(e) => setDefaultTopK(parseInt(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-600">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* Score threshold */}
          <div>
            <label className="mb-2 flex items-center justify-between text-sm text-slate-300">
              <span>Default Score Threshold</span>
              <span className="rounded bg-slate-700 px-2 py-0.5 text-xs tabular-nums text-teal-400">
                {defaultScoreThreshold.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(defaultScoreThreshold * 100)}
              onChange={(e) => setDefaultScoreThreshold(parseInt(e.target.value) / 100)}
              className="w-full accent-teal-500"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-600">
              <span>0.00</span>
              <span>1.00</span>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Feature Toggles */}
      <SettingsSection
        title="Features"
        description="Enable or disable system features"
        icon={<Cpu className="h-4 w-4" />}
      >
        <div className="space-y-5">
          <ToggleField
            label="Streaming Responses"
            description="Stream query results in real-time as they are retrieved"
            enabled={enableStreaming}
            onChange={setEnableStreaming}
          />
          <ToggleField
            label="Agent Execution Traces"
            description="Show detailed step-by-step agent execution information"
            enabled={enableAgentTraces}
            onChange={setEnableAgentTraces}
          />
          <ToggleField
            label="Result Caching"
            description="Cache query results to improve response times for repeated queries"
            enabled={enableCaching}
            onChange={setEnableCaching}
          />
          <ToggleField
            label="Usage Analytics"
            description="Collect anonymous usage analytics to improve the system"
            enabled={enableAnalytics}
            onChange={setEnableAnalytics}
          />
        </div>
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection
        title="Appearance"
        description="Customize the application look and feel"
        icon={<Palette className="h-4 w-4" />}
      >
        <div>
          <label className="mb-2 block text-sm text-slate-300">Theme</label>
          <div className="flex gap-2">
            {(["dark", "light", "system"] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => uiStore.setTheme(theme)}
                className={clsx(
                  "rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors",
                  uiStore.theme === theme
                    ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                )}
              >
                {theme}
              </button>
            ))}
          </div>
          {uiStore.theme === "light" && (
            <p className="mt-2 text-xs text-amber-400">
              Note: Light theme is not fully supported yet. Some components may not display correctly.
            </p>
          )}
        </div>
        <ToggleField
          label="Collapsed Sidebar"
          description="Show only icons in the sidebar navigation"
          enabled={uiStore.sidebarCollapsed}
          onChange={uiStore.setSidebarCollapsed}
        />
      </SettingsSection>

      {/* About */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Self-Querying Retriever</h2>
            <p className="mt-1 text-xs text-slate-500">
              Multi-agent RAG system with LangGraph, ChromaDB, and advanced retrieval methods
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="teal" size="sm">v1.0.0</Badge>
            <Badge variant="default" size="sm">LangGraph</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
