CREATE TABLE `video_job_progress_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`stage` enum('queued','reading','analyzing','clips','complete','failed') NOT NULL,
	`message` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_job_progress_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `video_job_progress_events` ADD CONSTRAINT `video_job_progress_events_jobId_video_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `video_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_job_progress_events` ADD CONSTRAINT `video_job_progress_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `video_job_progress_events_job_id_idx` ON `video_job_progress_events` (`jobId`,`id`);--> statement-breakpoint
CREATE INDEX `video_job_progress_events_user_id_idx` ON `video_job_progress_events` (`userId`,`id`);