CREATE TABLE `ledger_entries` (
	`voucher_number` text PRIMARY KEY NOT NULL,
	`voucher_date` text NOT NULL,
	`narration` text NOT NULL,
	`voucher_desc` text,
	`debit` real NOT NULL,
	`credit` real NOT NULL,
	`running_balance` real,
	`cash_flow_type` text NOT NULL,
	`include_in_capital_flow` integer NOT NULL,
	`fetched_at` text NOT NULL
);
