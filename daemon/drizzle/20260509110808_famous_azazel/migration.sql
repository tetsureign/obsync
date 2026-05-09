ALTER TABLE `sync_records` RENAME TO `sync_operations`;--> statement-breakpoint
ALTER TABLE `sync_operations` ADD `step` text NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_operations` ADD `started_at` integer DEFAULT (unixepoch()) NOT NULL;