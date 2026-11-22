CREATE TABLE `dortory_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`actor_id` text NOT NULL,
	`actor_label` text NOT NULL,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`outcome` text NOT NULL,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dortory_audit_action_idx` ON `dortory_audit_logs` (`action`,`id`);--> statement-breakpoint
CREATE TABLE `dortory_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`contents` text NOT NULL,
	`updated_at` integer NOT NULL
);
