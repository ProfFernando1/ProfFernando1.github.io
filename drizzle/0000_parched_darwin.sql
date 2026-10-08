CREATE TABLE `blog_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_blog_comments_post_date` ON `blog_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `blog_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`hits` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_blog_posts_status_date` ON `blog_posts` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `blog_reactions` (
	`post_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`post_id`, `visitor_id`),
	FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
