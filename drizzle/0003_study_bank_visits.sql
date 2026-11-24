CREATE TABLE `study_bank_visits` (
	`profile` integer NOT NULL,
	`bank` text NOT NULL,
	`opened` integer NOT NULL,
	PRIMARY KEY(`profile`, `bank`),
	FOREIGN KEY (`profile`) REFERENCES `study_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_study_bank_visits_bank_profile` ON `study_bank_visits` (`bank`,`profile`);