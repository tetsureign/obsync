CREATE TABLE `conflict_records` (
	`id` text PRIMARY KEY,
	`vault_id` text NOT NULL,
	`files` text NOT NULL,
	`strategy` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`updated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_conflict_records_vault_id_vaults_id_fk` FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sync_records` (
	`id` text PRIMARY KEY,
	`vault_id` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`commit_sha` text,
	`updated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_sync_records_vault_id_vaults_id_fk` FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`local_path` text NOT NULL UNIQUE,
	`remote` text NOT NULL,
	`branch` text DEFAULT 'main' NOT NULL,
	`is_dirty` integer DEFAULT false NOT NULL,
	`auto_sync` integer DEFAULT false NOT NULL,
	`sync_interval` integer DEFAULT 300 NOT NULL,
	`conflict_strategy` text DEFAULT 'log-and-skip' NOT NULL,
	`last_synced_at` integer,
	`updated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
