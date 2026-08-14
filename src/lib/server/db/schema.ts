import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Trading domain tables (carried over from the old Express project)
// ---------------------------------------------------------------------------

/**
 * One row per linked follower account (Kite or Kotak Neo).
 * The Dhan master account is not stored here — it's the source, configured via env vars.
 *
 * Security: kiteAccessToken/kitePassword/kiteTotpSecret and the kotak* secret columns are
 * encrypted at rest (AES-256-GCM, see src/lib/server/crypto.ts) by the remote functions in
 * accounts.remote.ts before insert — the columns themselves are just text, so nothing about
 * the schema needs to change if the encryption approach ever does.
 */
export const linkedAccounts = sqliteTable('linked_accounts', {
	id: text('id').primaryKey(), // e.g. "kite-main", "kotak-neo-1"
	broker: text('broker', { enum: ['kite', 'kotak_neo'] }).notNull(),
	label: text('label').notNull(), // friendly name, e.g. "Kite - Dad's account"
	multiplier: real('multiplier').notNull().default(1),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

	// Kite Connect — official app credentials, used for the actual generateSession + trading calls
	kiteApiKey: text('kite_api_key'),
	kiteApiSecret: text('kite_api_secret'),
	kiteAccessToken: text('kite_access_token'),
	kiteAccessTokenDate: text('kite_access_token_date'), // yyyy-mm-dd, tokens expire daily
	// Kite raw login credentials — used only to automate the login+TOTP form step (unofficial)
	kiteUserId: text('kite_user_id'),
	kitePassword: text('kite_password'),
	kiteTotpSecret: text('kite_totp_secret'),

	// Kotak Neo
	kotakConsumerKey: text('kotak_consumer_key'),
	kotakConsumerSecret: text('kotak_consumer_secret'),
	kotakMobileNumber: text('kotak_mobile_number'),
	kotakPassword: text('kotak_password'),
	kotakTotpSecret: text('kotak_totp_secret'),
	kotakMpin: text('kotak_mpin'),
	kotakAccessToken: text('kotak_access_token'),
	kotakSessionToken: text('kotak_session_token'),
	kotakSid: text('kotak_sid'),
	kotakTokenDate: text('kotak_token_date'),

	createdAt: text('created_at').notNull()
});

/**
 * Cache of Dhan's Ledger Report API (GET /v2/ledger) — every credit/debit on the
 * trading account, including bank deposits/withdrawals, trade settlements, and
 * charges all mixed together. `vouchernumber` is Dhan's own reference and is
 * used as the natural dedup key across repeated syncs.
 *
 * cashFlowType is auto-classified from the narration on first sync (see
 * services/capital.ts), but is admin-editable afterwards — misclassifying a
 * large brokerage charge as a withdrawal (or missing a real deposit) would
 * skew the manager-performance comparison, so this is reviewed, not trusted
 * blindly.
 */
export const ledgerEntries = sqliteTable('ledger_entries', {
	voucherNumber: text('voucher_number').primaryKey(),
	voucherDate: text('voucher_date').notNull(), // ISO yyyy-mm-dd, parsed from Dhan's "Jun 22, 2022"
	narration: text('narration').notNull(),
	voucherDesc: text('voucher_desc'),
	debit: real('debit').notNull(), // > 0 = money left the trading account
	credit: real('credit').notNull(), // > 0 = money entered the trading account
	runningBalance: real('running_balance'),
	cashFlowType: text('cash_flow_type', { enum: ['deposit', 'withdrawal', 'other'] }).notNull(),
	// Only 'deposit'/'withdrawal' rows the admin has confirmed represent real
	// capital movement (vs. e.g. a misclassified charge) feed the performance calc.
	includeInCapitalFlow: integer('include_in_capital_flow', { mode: 'boolean' }).notNull(),
	fetchedAt: text('fetched_at').notNull()
});

/** Global on/off switch + misc settings, single row keyed by `key`. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

/** Every master-account order event we saw, and what we did with it. */
export const tradeLog = sqliteTable('trade_log', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	dhanOrderNo: text('dhan_order_no').notNull(),
	symbol: text('symbol').notNull(),
	exchange: text('exchange').notNull(),
	transactionType: text('transaction_type').notNull(), // BUY / SELL
	status: text('status').notNull(), // TRANSIT/PENDING/TRADED/REJECTED/CANCELLED/EXPIRED
	productType: text('product_type'), // INTRADAY/CNC/MARGIN etc — needed for correct FIFO + charges
	masterQuantity: integer('master_quantity').notNull(),
	tradedPrice: real('traded_price'),
	raw: text('raw').notNull(), // JSON blob of the Dhan event, for debugging
	createdAt: text('created_at').notNull()
});

/** One row per replicated order attempt tied to a trade_log entry. */
export const replicationLog = sqliteTable('replication_log', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	tradeLogId: integer('trade_log_id').notNull(),
	accountId: text('account_id').notNull(),
	requestedQuantity: integer('requested_quantity').notNull(),
	status: text('status', { enum: ['success', 'failed', 'skipped', 'dry_run'] }).notNull(),
	brokerOrderId: text('broker_order_id'),
	error: text('error'),
	createdAt: text('created_at').notNull()
});

// ---------------------------------------------------------------------------
// Auth tables below this line are generated by `npx @better-auth/cli generate`
// (better-auth/adapters/drizzle, provider: "sqlite", plugins: [admin()]).
// Do not hand-edit them — re-run generate after changing src/lib/server/auth.ts.
// role: "user" | "admin" (from the admin plugin) drives route access.
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull(),
	role: text('role'),
	banned: integer('banned', { mode: 'boolean' }).default(false),
	banReason: text('ban_reason'),
	banExpires: integer('ban_expires', { mode: 'timestamp_ms' })
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		impersonatedBy: text('impersonated_by')
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		password: text('password'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	})
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	})
}));
