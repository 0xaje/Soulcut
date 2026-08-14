ALTER TABLE `mind_memories` ADD `retiredAt` timestamp;--> statement-breakpoint
ALTER TABLE `mind_memories` ADD `retirementReason` varchar(320);--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `transcriptStorageKey` varchar(1024);--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `transcriptFormat` enum('txt','srt','vtt');--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `transcriptCharacterCount` int;