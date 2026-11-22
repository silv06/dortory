CREATE TABLE `dortory_host_sessions` (
	`session_key` text PRIMARY KEY NOT NULL,
	`contents` text NOT NULL,
	`expires_at` integer NOT NULL
);
