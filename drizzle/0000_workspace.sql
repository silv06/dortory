CREATE TABLE `dortory_source_cache` (
	`source` text PRIMARY KEY NOT NULL,
	`contents` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dortory_workspace` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`contents` text NOT NULL,
	`updated_at` integer NOT NULL
);
