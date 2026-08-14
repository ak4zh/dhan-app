import { command, query } from '$app/server';
import { requireAdmin } from '$server/auth-guard';
import { sendTelegramAlert, formatTradeAlert } from '$server/services/telegram';
import { dhanOrdersWs } from '$server/services/dhan-orders-ws';

/** Test Telegram notification dispatch */
export const sendTestAlert = command(async () => {
	requireAdmin();
	const testMessage = formatTradeAlert({
		dhanOrderNo: 'TEST-' + Math.floor(100000 + Math.random() * 900000),
		symbol: 'NIFTY50',
		exchange: 'NSE',
		transactionType: 'BUY',
		status: 'TRADED',
		productType: 'CNC',
		quantity: 50,
		price: 24500.5,
		reason: 'Test Trade Alert from Dhan App Server'
	});

	const success = await sendTelegramAlert(testMessage);
	if (!success) {
		throw new Error('Failed to send test Telegram alert. Check bot token and chat ID in .env');
	}
	return { success: true, message: 'Test trade alert sent to Telegram!' };
});

/** Returns Dhan Orders WebSocket status */
export const getWsStatus = query(async () => {
	requireAdmin();
	return dhanOrdersWs.getStatus();
});
