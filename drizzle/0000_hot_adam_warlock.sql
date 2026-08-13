CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `linked_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`broker` text NOT NULL,
	`label` text NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`kite_api_key` text,
	`kite_api_secret` text,
	`kite_access_token` text,
	`kite_access_token_date` text,
	`kite_user_id` text,
	`kite_password` text,
	`kite_totp_secret` text,
	`kotak_consumer_key` text,
	`kotak_consumer_secret` text,
	`kotak_mobile_number` text,
	`kotak_password` text,
	`kotak_totp_secret` text,
	`kotak_mpin` text,
	`kotak_access_token` text,
	`kotak_session_token` text,
	`kotak_sid` text,
	`kotak_token_date` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `replication_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_log_id` integer NOT NULL,
	`account_id` text NOT NULL,
	`requested_quantity` integer NOT NULL,
	`status` text NOT NULL,
	`broker_order_id` text,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dhan_order_no` text NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`transaction_type` text NOT NULL,
	`status` text NOT NULL,
	`product_type` text,
	`master_quantity` integer NOT NULL,
	`traded_price` real,
	`raw` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);