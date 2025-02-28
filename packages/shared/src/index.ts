export * from "./config/queue";

export const VERSION = "0.0.1";

export interface Message {
	id: string;
	content: string;
	timestamp: Date;
}

export interface QueueMessage {
	id: string;
	type: string;
	payload: any;
	timestamp: Date;
}

export function generateId(): string {
	return Math.random().toString(36).substring(2, 15);
}
