CREATE TABLE `video_jobs` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`videoUrl` varchar(2048) NOT NULL,
	`videoTitle` varchar(512),
	`status` enum('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
	`summary` text,
	`topics` json,
	`clips` json,
	`sourceNote` text,
	`model` varchar(128),
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `video_jobs` ADD CONSTRAINT `video_jobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;