CREATE TABLE `conflict_records` (
	`id` text PRIMARY KEY NOT NULL,
	`vaultId` text NOT NULL,
	`files` text NOT NULL,
	`strategy` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`updatedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`vaultId`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_records` (
	`id` text PRIMARY KEY NOT NULL,
	`vaultId` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`commitSha` text,
	`updatedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`vaultId`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`localPath` text NOT NULL,
	`remote` text NOT NULL,
	`branch` text DEFAULT 'main' NOT NULL,
	`isDirty` integer DEFAULT false NOT NULL,
	`autoSync` integer DEFAULT false NOT NULL,
	`syncInterval` integer DEFAULT 300 NOT NULL,
	`conflictStrategy` text DEFAULT 'log-and-skip' NOT NULL,
	`lastSyncedAt` integer,
	`updatedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vaults_name_unique` ON `vaults` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `vaults_localPath_unique` ON `vaults` (`localPath`);