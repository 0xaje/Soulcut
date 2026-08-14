CREATE TABLE `analysis_usage` (
	`userId` int NOT NULL,
	`usageDate` date NOT NULL,
	`analysisCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysis_usage_userId_usageDate_pk` PRIMARY KEY(`userId`,`usageDate`)
);
--> statement-breakpoint
CREATE TABLE `request_rate_limits` (
	`userId` int NOT NULL,
	`scope` varchar(64) NOT NULL,
	`windowKey` varchar(32) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `request_rate_limits_userId_scope_windowKey_pk` PRIMARY KEY(`userId`,`scope`,`windowKey`)
);
--> statement-breakpoint
ALTER TABLE `video_job_progress_events` MODIFY COLUMN `stage` enum('queued','reading','analyzing','clips','retrying','complete','failed','cancelled') NOT NULL;--> statement-breakpoint
ALTER TABLE `video_jobs` MODIFY COLUMN `status` enum('pending','processing','retrying','done','failed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `attemptCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `maxAttempts` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `nextAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `workerToken` varchar(64);--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `workerClaimedAt` timestamp;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `lastAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `analysis_usage` ADD CONSTRAINT `analysis_usage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_rate_limits` ADD CONSTRAINT `request_rate_limits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `video_jobs_queue_idx` ON `video_jobs` (`status`,`nextAttemptAt`,`createdAt`);