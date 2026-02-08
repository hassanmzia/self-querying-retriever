import type {
  WebSocketMessage,
  WebSocketEventType,
  StreamingChunk,
  QueryProgressUpdate,
  AgentState,
} from "../types";

// ============================================================
// Types
// ============================================================

type MessageHandler = (message: WebSocketMessage) => void;
type EventHandler<T = unknown> = (payload: T) => void;

interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

interface WebSocketClientState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
}

// ============================================================
// WebSocket Client
// ============================================================

class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private state: WebSocketClientState;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private eventHandlers: Map<WebSocketEventType, Set<EventHandler>> =
    new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private globalHandlers: Set<MessageHandler> = new Set();

  constructor(config?: Partial<WebSocketConfig>) {
    const wsBaseUrl =
      import.meta.env.VITE_WS_URL || "ws://172.168.1.95:3084";

    this.config = {
      url: `${wsBaseUrl}/ws`,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config,
    };

    this.state = {
      connected: false,
      reconnecting: false,
      reconnectAttempts: 0,
    };
  }

  // ---- Connection Management ----

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn("[WS] Already connected");
      return;
    }

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventListeners();
    } catch (error) {
      console.error("[WS] Connection error:", error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.clearTimers();
    this.state.reconnecting = false;
    this.state.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect on intentional close
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.state.connected = false;
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.info("[WS] Connected to", this.config.url);
      this.state.connected = true;
      this.state.reconnecting = false;
      this.state.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(String(event.data));
        this.handleMessage(message);
      } catch (error) {
        console.error("[WS] Failed to parse message:", error);
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.info(
        `[WS] Disconnected (code: ${event.code}, reason: ${event.reason})`
      );
      this.state.connected = false;
      this.clearTimers();

      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event: Event) => {
      console.error("[WS] Error:", event);
    };
  }

  private scheduleReconnect(): void {
    if (
      this.state.reconnecting ||
      this.state.reconnectAttempts >= this.config.maxReconnectAttempts
    ) {
      if (
        this.state.reconnectAttempts >= this.config.maxReconnectAttempts
      ) {
        console.error("[WS] Max reconnection attempts reached");
      }
      return;
    }

    this.state.reconnecting = true;
    this.state.reconnectAttempts++;

    const delay =
      this.config.reconnectInterval *
      Math.pow(1.5, this.state.reconnectAttempts - 1);

    console.info(
      `[WS] Reconnecting in ${delay}ms (attempt ${this.state.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.state.reconnecting = false;
      this.connect();
    }, delay);
  }

  // ---- Heartbeat ----

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: "ping" as WebSocketEventType,
          payload: null,
          timestamp: new Date().toISOString(),
        });
      }
    }, this.config.heartbeatInterval);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ---- Message Handling ----

  private handleMessage(message: WebSocketMessage): void {
    // Dispatch to global handlers
    this.globalHandlers.forEach((handler) => handler(message));

    // Dispatch to event-specific handlers
    const eventHandlers = this.eventHandlers.get(message.type);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(message.payload));
    }

    // Dispatch to correlation-specific handlers
    if (message.correlation_id) {
      const correlationHandlers = this.messageHandlers.get(
        message.correlation_id
      );
      if (correlationHandlers) {
        correlationHandlers.forEach((handler) => handler(message));
      }
    }
  }

  // ---- Public API ----

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send - not connected");
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  sendQuery(
    queryId: string,
    query: string,
    options: Record<string, unknown> = {}
  ): void {
    this.send({
      type: "query_start" as WebSocketEventType,
      payload: { query_id: queryId, query, ...options },
      timestamp: new Date().toISOString(),
      correlation_id: queryId,
    });
  }

  // ---- Event Subscription ----

  onMessage(handler: MessageHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  on<T = unknown>(
    eventType: WebSocketEventType,
    handler: EventHandler<T>
  ): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    const handlers = this.eventHandlers.get(eventType)!;
    const typedHandler = handler as EventHandler;
    handlers.add(typedHandler);

    return () => {
      handlers.delete(typedHandler);
    };
  }

  onCorrelation(correlationId: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(correlationId)) {
      this.messageHandlers.set(correlationId, new Set());
    }
    this.messageHandlers.get(correlationId)!.add(handler);

    return () => {
      const handlers = this.messageHandlers.get(correlationId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(correlationId);
        }
      }
    };
  }

  // Convenience typed event listeners

  onQueryChunk(handler: EventHandler<StreamingChunk>): () => void {
    return this.on<StreamingChunk>("query_chunk" as WebSocketEventType, handler);
  }

  onQueryProgress(handler: EventHandler<QueryProgressUpdate>): () => void {
    return this.on<QueryProgressUpdate>(
      "query_progress" as WebSocketEventType,
      handler
    );
  }

  onAgentUpdate(handler: EventHandler<AgentState>): () => void {
    return this.on<AgentState>("agent_update" as WebSocketEventType, handler);
  }

  onQueryResult(handler: EventHandler<unknown>): () => void {
    return this.on("query_result" as WebSocketEventType, handler);
  }

  onQueryError(
    handler: EventHandler<{ error: string; query_id: string }>
  ): () => void {
    return this.on<{ error: string; query_id: string }>(
      "query_error" as WebSocketEventType,
      handler
    );
  }

  // ---- State ----

  get isConnected(): boolean {
    return this.state.connected;
  }

  get isReconnecting(): boolean {
    return this.state.reconnecting;
  }

  get reconnectAttempts(): number {
    return this.state.reconnectAttempts;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();

export default WebSocketClient;
