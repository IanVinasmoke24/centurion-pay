import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { RateInfo } from './RateService';

interface WSClient {
  ws: WebSocket;
  sessionToken?: string;
  merchantAddress?: string;
  connectedAt: number;
}

let wss: WebSocketServer | null = null;
const clients = new Set<WSClient>();

export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

function send(client: WSClient, message: WsMessage): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

function broadcast(message: WsMessage): void {
  for (const client of clients) {
    send(client, message);
  }
}

export function initialize(httpServer: HttpServer): void {
  if (wss) return;

  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientInfo: WSClient = {
      ws,
      connectedAt: Date.now(),
    };
    clients.add(clientInfo);

    logger.info('WS client connected', {
      ip: req.socket.remoteAddress,
      total: clients.size,
    });

    // Send welcome message
    send(clientInfo, {
      type: 'connected',
      payload: { message: 'Centurion WebSocket connected' },
      timestamp: Date.now(),
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string;
          sessionToken?: string;
          merchantAddress?: string;
        };

        // Clients can subscribe to specific sessions or merchant feeds
        if (msg.type === 'subscribe_session' && msg.sessionToken) {
          clientInfo.sessionToken = msg.sessionToken;
          logger.debug('WS subscribed to session', { token: msg.sessionToken });
        } else if (msg.type === 'subscribe_merchant' && msg.merchantAddress) {
          clientInfo.merchantAddress = msg.merchantAddress;
          logger.debug('WS subscribed to merchant', { address: msg.merchantAddress });
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    ws.on('close', () => {
      clients.delete(clientInfo);
      logger.info('WS client disconnected', { total: clients.size });
    });

    ws.on('error', (err) => {
      logger.error('WS client error', { err });
      clients.delete(clientInfo);
    });
  });

  logger.info('WebSocket server initialized');
}

export function notifyPaymentSettled(sessionToken: string, txHash: string): void {
  const message: WsMessage = {
    type: 'payment_settled',
    payload: { sessionToken, txHash },
    timestamp: Date.now(),
  };

  let notified = 0;
  for (const client of clients) {
    if (
      client.sessionToken === sessionToken ||
      !client.sessionToken // broadcast to unfiltered clients
    ) {
      send(client, message);
      notified++;
    }
  }

  logger.info('Payment settled notification sent', {
    sessionToken,
    txHash,
    notified,
  });
}

export function notifyMerchantPayment(merchantAddress: string, data: unknown): void {
  const message: WsMessage = {
    type: 'merchant_payment',
    payload: data,
    timestamp: Date.now(),
  };

  for (const client of clients) {
    if (
      client.merchantAddress === merchantAddress ||
      !client.merchantAddress
    ) {
      send(client, message);
    }
  }
}

export function notifyRateUpdate(rates: RateInfo[]): void {
  broadcast({
    type: 'rate_update',
    payload: rates,
    timestamp: Date.now(),
  });
}

export function getConnectedCount(): number {
  return clients.size;
}

export function shutdown(): void {
  if (wss) {
    wss.close();
    clients.clear();
    wss = null;
    logger.info('WebSocket server shut down');
  }
}
