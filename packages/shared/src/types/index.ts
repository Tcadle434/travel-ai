// Add to your existing types in packages/shared/src/types/index.ts

export interface Conversation {
	id: string;
	userId: string;
	title: string;
	lastMessage: string;
	createdAt: Date;
	updatedAt: Date;
}

// Add this to your message queue types
export type MessageType =
	| "CONVERSATION_UPDATED"
	| "CONVERSATION_CREATED"
	| "CONVERSATION_LISTED"
	| "GENERATE_ITINERARY"
	| "ITINERARY_GENERATED";
