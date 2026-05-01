CREATE TABLE `exams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discipline` varchar(64) NOT NULL,
	`questionCount` int NOT NULL,
	`topics` text NOT NULL,
	`questions` json NOT NULL,
	`examPdfKey` varchar(512),
	`answerPdfKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exams_id` PRIMARY KEY(`id`)
);
