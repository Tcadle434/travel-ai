// Common interfaces for the chat application

export interface Message {
	id: string;
	content: string;
	isUser: boolean;
	timestamp: Date;
}

export interface ApiMessage {
	id: string;
	conversationId: string;
	userId: string;
	role: string;
	content: string;
	timestamp: string | Date;
}

export interface ConversationHistory {
	id: string;
	title: string;
	lastMessage: string;
	timestamp: Date;
	updatedAt?: Date;
	createdAt?: Date;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}
