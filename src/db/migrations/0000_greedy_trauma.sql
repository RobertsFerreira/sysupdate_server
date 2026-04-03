CREATE TABLE `installations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`install_id` text NOT NULL,
	`public_key` text NOT NULL,
	`role` text DEFAULT 'pending' NOT NULL,
	`label` text,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP,
	`last_seen` text,
	`revoked` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installations_install_id_unique` ON `installations` (`install_id`);--> statement-breakpoint
CREATE TABLE `release_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`release_id` integer NOT NULL,
	`target` text NOT NULL,
	`checksum` text NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` text NOT NULL,
	`description` text,
	`min_version` text,
	`bundle_file` text NOT NULL,
	`bundle_checksum` text NOT NULL,
	`release_date` text NOT NULL,
	`published_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `releases_version_unique` ON `releases` (`version`);