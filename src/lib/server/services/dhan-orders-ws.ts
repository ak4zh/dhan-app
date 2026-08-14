import { getStoredDhanToken } from './settings';
import { dhanEnv } from '../config';
import { db } from '../db/client';
import { tradeLog } from '../db/schema';
import { sendTelegramAlert, formatTradeAlert } from './telegram';

const DHAN_WS_URL = 'wss://api-order-update.dhan.co';

class DhanOrdersWebSocketManager {
	private ws: WebSocket | null = null;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private pingInterval: NodeJS.Timeout | null = null;
	private isConnecting = false;
	private isConnected = false;

	public async connect() {
		if (this.isConnected || this.isConnecting) return;
		this.isConnecting = true;

		try {
			const stored = await getStoredDhanToken();
			const accessToken = stored?.accessToken || dhanEnv.DHAN_ACCESS_TOKEN;
			const clientId = dhanEnv.DHAN_CLIENT_ID;

			if (!accessToken || !clientId) {
				console.warn('Dhan Orders WS: Missing Dhan access token or client ID — connection delayed.');
				this.scheduleReconnect();
				return;
			}

			const url = `${DHAN_WS_URL}?token=${encodeURIComponent(accessToken)}&clientId=${encodeURIComponent(clientId)}`;
			console.log(`Connecting to Dhan Live Orders WebSocket (${DHAN_WS_URL})...`);

			this.ws = new WebSocket(url);

			this.ws.onopen = () => {
				console.log('⚡ Connected to Dhan Live Orders WebSocket successfully.');
				this.isConnected = true;
				this.isConnecting = false;
				this.startHeartbeat();
			};

			this.ws.onmessage = async (event: MessageEvent) => {
				try {
					const data = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
					await this.handleOrderUpdateMessage(data);
				} catch (err: any) {
					console.error('Error handling Dhan WS message:', err?.message || err);
				}
			};

			this.ws.onerror = (err: Event) => {
				console.error('Dhan Orders WS Error:', err);
			};

			this.ws.onclose = () => {
				console.warn('Dhan Orders WS Connection closed.');
				this.cleanup();
				this.scheduleReconnect();
			};
		} catch (err: any) {
			console.error('Failed to initiate Dhan Orders WS connection:', err?.message || err);
			this.cleanup();
			this.scheduleReconnect();
		}
	}

	private async handleOrderUpdateMessage(rawText: string) {
		if (!rawText || rawText.trim() === 'pong') return;

		let payload: any;
		try {
			payload = JSON.parse(rawText);
		} catch {
			// Non-JSON frame (e.g. heartbeat)
			return;
		}

		console.log('Dhan WS Order Event Received:', payload);

		const dhanOrderNo = String(payload.orderId || payload.dhanOrderNo || payload.dhanClientId || Date.now());
		const symbol = String(payload.tradingSymbol || payload.customSymbol || payload.securityId || 'UNKNOWN');
		const exchange = String(payload.exchangeSegment || payload.exchange || 'NSE');
		const transactionType = String(payload.transactionType || 'BUY').toUpperCase();
		const status = String(payload.orderStatus || payload.status || 'TRADED').toUpperCase();
		const productType = String(payload.productType || 'CNC');
		const quantity = Number(payload.tradedQuantity || payload.quantity || payload.masterQuantity || 0);
		const price = Number(payload.tradedPrice || payload.price || 0);
		const reason = payload.reason || payload.errorMessage || payload.rejectReason;

		// 1. Log order update to Database tradeLog table
		try {
			await db.insert(tradeLog).values({
				dhanOrderNo,
				symbol,
				exchange,
				transactionType,
				status,
				productType,
				masterQuantity: quantity,
				tradedPrice: price,
				raw: JSON.stringify(payload),
				createdAt: new Date().toISOString()
			}).catch(() => {
				// Ignore duplicate key inserts if raw order update frame fires multiple times
			});
		} catch (err: any) {
			console.error('Failed to log Dhan WS trade event to DB:', err?.message || err);
		}

		// 2. Dispatch real-time Telegram trade alert
		const formattedMsg = formatTradeAlert({
			dhanOrderNo,
			symbol,
			exchange,
			transactionType,
			status,
			productType,
			quantity,
			price,
			reason
		});

		await sendTelegramAlert(formattedMsg);
	}

	private startHeartbeat() {
		this.clearHeartbeat();
		this.pingInterval = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				try {
					this.ws.send('ping');
				} catch {
					// Ignore
				}
			}
		}, 30000);
	}

	private clearHeartbeat() {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	private scheduleReconnect() {
		this.isConnecting = false;
		this.isConnected = false;
		if (!this.reconnectTimer) {
			this.reconnectTimer = setTimeout(() => {
				this.reconnectTimer = null;
				this.connect();
			}, 10000); // Reconnect backoff 10s
		}
	}

	private cleanup() {
		this.isConnecting = false;
		this.isConnected = false;
		this.clearHeartbeat();
		if (this.ws) {
			try {
				this.ws.onopen = null;
				this.ws.onmessage = null;
				this.ws.onerror = null;
				this.ws.onclose = null;
				this.ws.close();
			} catch {
				// Ignore
			}
			this.ws = null;
		}
	}

	public getStatus() {
		return {
			isConnected: this.isConnected,
			isConnecting: this.isConnecting
		};
	}
}

export const dhanOrdersWs = new DhanOrdersWebSocketManager();

export function initDhanOrdersWs() {
	dhanOrdersWs.connect().catch((err) => {
		console.error('Error starting Dhan Orders WS:', err);
	});
}
