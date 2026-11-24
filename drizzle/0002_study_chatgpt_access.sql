CREATE TABLE `study_accounts` (
	`id` integer PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`display_name` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_accounts_subject_unique` ON `study_accounts` (`subject`);--> statement-breakpoint
CREATE TABLE `study_attempts` (
	`id` integer PRIMARY KEY NOT NULL,
	`bank` text NOT NULL,
	`profile` integer NOT NULL,
	`question` text NOT NULL,
	`choice` text NOT NULL,
	`correct` integer NOT NULL,
	`ts` integer NOT NULL,
	`request_key` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`profile`) REFERENCES `study_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_study_attempts_profile_bank_request` ON `study_attempts` (`profile`,`bank`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_study_attempts_profile_bank_question` ON `study_attempts` (`profile`,`bank`,`question`,`id`);--> statement-breakpoint
CREATE TABLE `study_cursors` (
	`profile` integer NOT NULL,
	`bank` text NOT NULL,
	`question` text,
	`filters` text,
	PRIMARY KEY(`profile`, `bank`),
	FOREIGN KEY (`profile`) REFERENCES `study_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `study_favorites` (
	`profile` integer NOT NULL,
	`bank` text NOT NULL,
	`question` text NOT NULL,
	PRIMARY KEY(`profile`, `bank`, `question`),
	FOREIGN KEY (`profile`) REFERENCES `study_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `study_tae_attempts` (
	`id` integer PRIMARY KEY NOT NULL,
	`profile` integer NOT NULL,
	`question` text NOT NULL,
	`choice` text NOT NULL,
	`ts` integer NOT NULL,
	`request_key` text NOT NULL,
	FOREIGN KEY (`profile`) REFERENCES `study_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_study_tae_attempts_profile_request` ON `study_tae_attempts` (`profile`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_study_tae_attempts_profile_question` ON `study_tae_attempts` (`profile`,`question`,`id`);--> statement-breakpoint
CREATE INDEX `idx_study_tae_attempts_profile_recent` ON `study_tae_attempts` (`profile`,`id`);--> statement-breakpoint
CREATE INDEX `idx_study_tae_attempts_profile_time` ON `study_tae_attempts` (`profile`,`ts`);--> statement-breakpoint
CREATE TABLE `study_tae_saved` (
	`profile` integer NOT NULL,
	`question` text NOT NULL,
	PRIMARY KEY(`profile`, `question`),
	FOREIGN KEY (`profile`) REFERENCES `study_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
