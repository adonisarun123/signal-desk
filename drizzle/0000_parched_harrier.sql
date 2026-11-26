CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_owner_domain` ON `clients` (`owner`,`domain`);--> statement-breakpoint
CREATE TABLE `desk_job_runs` (
	`bucket` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`lease` text NOT NULL,
	`finished_at` text,
	`result` text
);
--> statement-breakpoint
CREATE TABLE `desk_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`schedule_enabled` integer DEFAULT 1 NOT NULL,
	`last_check` text
);
