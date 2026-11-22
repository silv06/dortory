CREATE TABLE `dortory_receipts` (
	`case_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`state` text NOT NULL,
	`attempted_at` integer NOT NULL,
	`first_attempt_at` integer NOT NULL,
	`sent_at` integer,
	`provider_id` text
);
--> statement-breakpoint
CREATE INDEX `dortory_receipts_account_idx` ON `dortory_receipts` (`account_id`);