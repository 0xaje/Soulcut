CREATE TABLE `pdf_report_branding` (
	`userId` int NOT NULL,
	`coverTitle` varchar(140) NOT NULL DEFAULT 'Video Analysis Report',
	`logoStorageKey` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pdf_report_branding_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `pdf_report_shares` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `pdf_report_shares` ADD `revokedAt` timestamp;--> statement-breakpoint
ALTER TABLE `pdf_report_branding` ADD CONSTRAINT `pdf_report_branding_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;