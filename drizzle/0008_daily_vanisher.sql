ALTER TABLE `feedback_events` ADD `signalCategory` varchar(32);--> statement-breakpoint
ALTER TABLE `feedback_events` ADD `signalKey` varchar(128);--> statement-breakpoint
ALTER TABLE `feedback_events` ADD `signalValue` varchar(240);--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `mindContextSnapshot` json;--> statement-breakpoint
CREATE INDEX `feedback_events_mind_signal_idx` ON `feedback_events` (`mindId`,`signalKey`,`createdAt`);