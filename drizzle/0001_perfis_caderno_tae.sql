CREATE TABLE `tae_attempts` (
	`id` integer PRIMARY KEY NOT NULL,
	`profile` integer NOT NULL,
	`question` text NOT NULL,
	`choice` text NOT NULL,
	`ts` integer NOT NULL,
	`request_key` text NOT NULL,
	FOREIGN KEY (`profile`) REFERENCES `tae_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tae_attempts_profile_request` ON `tae_attempts` (`profile`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_tae_attempts_profile_question` ON `tae_attempts` (`profile`,`question`,`id`);--> statement-breakpoint
CREATE INDEX `idx_tae_attempts_profile_recent` ON `tae_attempts` (`profile`,`id`);--> statement-breakpoint
CREATE INDEX `idx_tae_attempts_profile_time` ON `tae_attempts` (`profile`,`ts`);--> statement-breakpoint
CREATE TABLE `tae_login_limits` (
	`client` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tae_login_limits_expires` ON `tae_login_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `tae_profiles` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tae_profiles_username_unique` ON `tae_profiles` (`username`);--> statement-breakpoint
CREATE TABLE `tae_saved` (
	`profile` integer NOT NULL,
	`question` text NOT NULL,
	PRIMARY KEY(`profile`, `question`),
	FOREIGN KEY (`profile`) REFERENCES `tae_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tae_sessions` (
	`digest` text PRIMARY KEY NOT NULL,
	`profile` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`profile`) REFERENCES `tae_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tae_sessions_expires` ON `tae_sessions` (`expires`);--> statement-breakpoint
CREATE INDEX `idx_tae_sessions_profile` ON `tae_sessions` (`profile`);