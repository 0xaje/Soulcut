CREATE TABLE `pdf_report_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pdf_report_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `pdf_report_shares_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `pdf_report_shares` ADD CONSTRAINT `pdf_report_shares_jobId_video_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `video_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdf_report_shares` ADD CONSTRAINT `pdf_report_shares_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pdf_report_shares_job_user_idx` ON `pdf_report_shares` (`jobId`,`userId`);--> statement-breakpoint
CREATE INDEX `pdf_report_shares_token_idx` ON `pdf_report_shares` (`token`);