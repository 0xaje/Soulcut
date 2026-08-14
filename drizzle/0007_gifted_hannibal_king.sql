CREATE TABLE `creative_minds` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(140) NOT NULL DEFAULT 'SoulCut Creative Director',
	`externalMindId` varchar(64),
	`externalStatus` enum('not_linked','verified','unavailable') NOT NULL DEFAULT 'not_linked',
	`onboardedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creative_minds_id` PRIMARY KEY(`id`),
	CONSTRAINT `creative_minds_user_id_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `creative_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mindId` varchar(32) NOT NULL,
	`memoryId` int NOT NULL,
	`category` varchar(32) NOT NULL,
	`label` varchar(160) NOT NULL,
	`confidence` int NOT NULL,
	`source` varchar(64) NOT NULL,
	`evidenceCount` int NOT NULL DEFAULT 1,
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creative_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `creative_preferences_memory_id_unique` UNIQUE(`memoryId`)
);
--> statement-breakpoint
CREATE TABLE `feedback_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mindId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(32),
	`recommendationId` varchar(128),
	`feedbackType` enum('keep','not_my_style','teach') NOT NULL,
	`reason` varchar(80),
	`feedbackText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memory_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memoryId` int NOT NULL,
	`source` enum('onboarding','teaching','feedback','analysis','selection') NOT NULL,
	`sourceReference` varchar(128),
	`detail` text NOT NULL,
	`weight` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mind_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mindId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`memoryId` int,
	`activityType` enum('learned','updated','reinforced','detected') NOT NULL,
	`message` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mind_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mind_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mindId` varchar(32) NOT NULL,
	`category` enum('voice','hook','pacing','caption','visual','audience','editing','storytelling','topics','avoidances','format','tone') NOT NULL,
	`memoryKey` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`confidence` int NOT NULL DEFAULT 50,
	`source` enum('explicit_creator_instruction','feedback','behavioral_pattern','analysis_observation') NOT NULL,
	`evidenceCount` int NOT NULL DEFAULT 1,
	`lastReinforcedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mind_memories_id` PRIMARY KEY(`id`),
	CONSTRAINT `mind_memories_mind_category_key_unique` UNIQUE(`mindId`,`category`,`memoryKey`)
);
--> statement-breakpoint
ALTER TABLE `creative_minds` ADD CONSTRAINT `creative_minds_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creative_preferences` ADD CONSTRAINT `creative_preferences_mindId_creative_minds_id_fk` FOREIGN KEY (`mindId`) REFERENCES `creative_minds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creative_preferences` ADD CONSTRAINT `creative_preferences_memoryId_mind_memories_id_fk` FOREIGN KEY (`memoryId`) REFERENCES `mind_memories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback_events` ADD CONSTRAINT `feedback_events_mindId_creative_minds_id_fk` FOREIGN KEY (`mindId`) REFERENCES `creative_minds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback_events` ADD CONSTRAINT `feedback_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback_events` ADD CONSTRAINT `feedback_events_jobId_video_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `video_jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memory_evidence` ADD CONSTRAINT `memory_evidence_memoryId_mind_memories_id_fk` FOREIGN KEY (`memoryId`) REFERENCES `mind_memories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mind_activity` ADD CONSTRAINT `mind_activity_mindId_creative_minds_id_fk` FOREIGN KEY (`mindId`) REFERENCES `creative_minds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mind_activity` ADD CONSTRAINT `mind_activity_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mind_activity` ADD CONSTRAINT `mind_activity_memoryId_mind_memories_id_fk` FOREIGN KEY (`memoryId`) REFERENCES `mind_memories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mind_memories` ADD CONSTRAINT `mind_memories_mindId_creative_minds_id_fk` FOREIGN KEY (`mindId`) REFERENCES `creative_minds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `creative_preferences_mind_updated_idx` ON `creative_preferences` (`mindId`,`lastUpdatedAt`);--> statement-breakpoint
CREATE INDEX `feedback_events_mind_created_idx` ON `feedback_events` (`mindId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `feedback_events_user_created_idx` ON `feedback_events` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `memory_evidence_memory_created_idx` ON `memory_evidence` (`memoryId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mind_activity_mind_created_idx` ON `mind_activity` (`mindId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mind_activity_user_created_idx` ON `mind_activity` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mind_memories_mind_updated_idx` ON `mind_memories` (`mindId`,`updatedAt`);