import WebSocket, { WebSocketServer } from 'ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { WSMessage, WSMessageType, WSStreamChunk } from '../types';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  subscribedQueries: Set<string>;
  isAlive: boolean;
  connectedAt: Date;
}

/**
 * WebSocket manager for handling real-time streaming of agent responses
 * and other real-time communication with the frontend.
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: false,
    });

    this.initialize();
    this.startHeartbeat();

    logger.info('WebSocket server initialized on path /ws');
  }

  /**
   * Set up connection handling.
   */
  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error: Error) => {
      logger.error('WebSocket server error', { error: error.message });
    });
  }

  /**
   * Handle a new WebSocket connection.
   */
  public handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = uuidv4();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const client: ClientConnection = {
      id: clientId,
      ws,
      subscribedQueries: new Set(),
      isAlive: true,
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    logger.info('WebSocket client connected', {
      clientId,
      ip: clientIp,
      totalClients: this.clients.size,
    });

    // Send welcome message
    this.sendToClient(client, {
      type: 'stream_start',
      payload: { clientId, message: 'Connected to API Gateway WebSocket' },
      timestamp: new Date().toISOString(),
    });

    // Set up event handlers
    ws.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(client, data);
    });

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('close', (code: number, reason: Buffer) => {
      logger.info('WebSocket client disconnected', {
        clientId,
        code,
        reason: reason.toString(),
        totalClients: this.clients.size - 1,
      });
      this.clients.delete(clientId);
    });

    ws.on('error', (error: Error) => {
      logger.error('WebSocket client error', {
        clientId,
        error: error.message,
      });
      this.clients.delete(clientId);
    });
  }

  /**
   * Handle an incoming WebSocket message from a client.
   */
  private handleMessage(client: ClientConnection, data: WebSocket.RawData): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());

      logger.debug('WebSocket message received', {
        clientId: client.id,
        type: message.type,
      });

      switch (message.type) {
        case 'ping':
          this.sendToClient(client, {
            type: 'pong',
            payload: {},
            timestamp: new Date().toISOString(),
          });
          break;

        case 'query':
          this.handleStreamingQuery(client.ws, message.payload as any);
          break;

        case 'subscribe':
          this.handleSubscribe(client, message.payload as { queryId: string });
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(client, message.payload as { queryId: string });
          break;

        default:
          this.sendToClient(client, {
            type: 'stream_error',
            payload: { error: `Unknown message type: ${message.type}` },
            timestamp: new Date().toISOString(),
          });
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        clientId: client.id,
        error: (error as Error).message,
      });
      this.sendToClient(client, {
        type: 'stream_error',
        payload: { error: 'Invalid message format. Expected JSON.' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle query subscription - client wants updates for a specific query ID.
   */
  private handleSubscribe(client: ClientConnection, payload: { queryId: string }): void {
    if (payload.queryId) {
      client.subscribedQueries.add(payload.queryId);
      logger.debug('Client subscribed to query', {
        clientId: client.id,
        queryId: payload.queryId,
      });
    }
  }

  /**
   * Handle query unsubscription.
   */
  private handleUnsubscribe(client: ClientConnection, payload: { queryId: string }): void {
    if (payload.queryId) {
      client.subscribedQueries.delete(payload.queryId);
      logger.debug('Client unsubscribed from query', {
        clientId: client.id,
        queryId: payload.queryId,
      });
    }
  }

  /**
   * Stream agent responses in real-time from the Django backend.
   * Sends incremental chunks to the WebSocket client as they arrive.
   */
  public async handleStreamingQuery(
    ws: WebSocket,
    queryData: { query: string; collection?: string; method?: string; queryId?: string }
  ): Promise<void> {
    const queryId = queryData.queryId || uuidv4();

    logger.info('Starting streaming query', { queryId, query: queryData.query });

    // Notify client that streaming has started
    this.sendToWs(ws, {
      type: 'stream_start',
      payload: { queryId, query: queryData.query },
      id: queryId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Make a streaming request to the Django backend
      const response = await axios({
        method: 'POST',
        url: `${config.djangoBackendUrl}/api/query/`,
        data: {
          query: queryData.query,
          collection: queryData.collection,
          method: queryData.method || 'self_query',
          stream: true,
        },
        responseType: 'stream',
        timeout: config.proxyTimeout,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-Request-ID': queryId,
        },
      });

      let chunkIndex = 0;

      response.data.on('data', (rawChunk: Buffer) => {
        const chunkStr = rawChunk.toString();

        // Parse SSE data lines
        const lines = chunkStr.split('\n').filter((line: string) => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6); // Remove "data: " prefix

          if (data === '[DONE]') {
            this.sendToWs(ws, {
              type: 'stream_end',
              payload: { queryId, totalChunks: chunkIndex },
              id: queryId,
              timestamp: new Date().toISOString(),
            });

            // Also broadcast to subscribed clients
            this.broadcastToQuery(queryId, {
              type: 'stream_end',
              payload: { queryId, totalChunks: chunkIndex },
              id: queryId,
              timestamp: new Date().toISOString(),
            });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const chunk: WSStreamChunk = {
              queryId,
              chunk: parsed.content || parsed.text || data,
              index: chunkIndex++,
              done: false,
              metadata: parsed.metadata,
            };

            this.sendToWs(ws, {
              type: 'stream_chunk',
              payload: chunk,
              id: queryId,
              timestamp: new Date().toISOString(),
            });

            // Also broadcast to subscribed clients
            this.broadcastToQuery(queryId, {
              type: 'stream_chunk',
              payload: chunk,
              id: queryId,
              timestamp: new Date().toISOString(),
            });
          } catch {
            // If data is not JSON, send it as raw text chunk
            const chunk: WSStreamChunk = {
              queryId,
              chunk: data,
              index: chunkIndex++,
              done: false,
            };

            this.sendToWs(ws, {
              type: 'stream_chunk',
              payload: chunk,
              id: queryId,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });

      response.data.on('end', () => {
        // Ensure stream_end is sent even if [DONE] was not received
        this.sendToWs(ws, {
          type: 'stream_end',
          payload: { queryId, totalChunks: chunkIndex },
          id: queryId,
          timestamp: new Date().toISOString(),
        });

        logger.info('Streaming query completed', { queryId, totalChunks: chunkIndex });
      });

      response.data.on('error', (error: Error) => {
        logger.error('Stream error from backend', { queryId, error: error.message });
        this.sendToWs(ws, {
          type: 'stream_error',
          payload: { queryId, error: 'Stream interrupted' },
          id: queryId,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error: any) {
      const errorMessage =
        error.code === 'ECONNREFUSED'
          ? 'Backend service is unavailable'
          : error.message || 'Failed to process streaming query';

      logger.error('Streaming query failed', {
        queryId,
        error: error.message,
        code: error.code,
      });

      this.sendToWs(ws, {
        type: 'stream_error',
        payload: { queryId, error: errorMessage },
        id: queryId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast a message to all clients subscribed to a specific query.
   */
  public broadcastToQuery(queryId: string, message: WSMessage): void {
    let recipientCount = 0;

    this.clients.forEach((client) => {
      if (client.subscribedQueries.has(queryId) && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
        recipientCount++;
      }
    });

    if (recipientCount > 0) {
      logger.debug('Broadcast to query subscribers', { queryId, recipientCount });
    }
  }

  /**
   * Send a message to a specific client connection.
   */
  private sendToClient(client: ClientConnection, message: WSMessage): void {
    this.sendToWs(client.ws, message);
  }

  /**
   * Send a message to a WebSocket.
   */
  private sendToWs(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send WebSocket message', {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Heartbeat mechanism to detect and clean up stale connections.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          logger.debug('Terminating stale WebSocket connection', { clientId });
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, config.wsHeartbeatInterval);
  }

  /**
   * Get connection statistics.
   */
  public getStats(): {
    totalConnections: number;
    activeConnections: number;
    subscriptions: number;
  } {
    let subscriptions = 0;
    let activeConnections = 0;

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        activeConnections++;
      }
      subscriptions += client.subscribedQueries.size;
    });

    return {
      totalConnections: this.clients.size,
      activeConnections,
      subscriptions,
    };
  }

  /**
   * Gracefully shut down the WebSocket server.
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((client) => {
      this.sendToClient(client, {
        type: 'stream_end',
        payload: { message: 'Server shutting down' },
        timestamp: new Date().toISOString(),
      });
      client.ws.close(1001, 'Server shutting down');
    });

    this.wss.close();
    logger.info('WebSocket server shut down');
  }
}

export default WebSocketManager;
