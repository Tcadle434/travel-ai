// packages/shared/src/config/queue.ts
export const QUEUE_CONFIG = {
	RABBITMQ_URL: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",

	// Queue names
	QUEUES: {
		CONVERSATION: "conversation",
		ITINERARY_GENERATION: "itinerary-generation",
		NOTIFICATION: "notification",
	},

	// Exchange names
	EXCHANGES: {
		TRAVEL: "travel-exchange",
	},

	// Routing keys - Standardized across all services
	ROUTING_KEYS: {
		CONVERSATION_UPDATED: "conversation.updated",
		CONVERSATION_CREATED: "conversation.created",
		CONVERSATION_LISTED: "conversation.listed",
		CONVERSATION_MESSAGES: "conversation.messages",
		CONVERSATION_TITLE_UPDATED: "conversation.title.updated",
		CONVERSATION_SWITCHED: "conversation.switched",
		NOTIFICATION: "notification",
		GENERATE_ITINERARY: "itinerary.generate",
		ITINERARY_GENERATED: "itinerary.generated",
	},
};

// Standardized message types
export type MessageType =
	| "CONVERSATION_UPDATED"
	| "CONVERSATION_CREATED"
	| "GET_CONVERSATIONS"
	| "CONVERSATION_LISTED"
	| "SWITCH_CONVERSATION"
	| "CONVERSATION_SWITCHED"
	| "UPDATE_CONVERSATION_TITLE"
	| "CONVERSATION_TITLE_UPDATED"
	| "GET_CONVERSATION_MESSAGES"
	| "CONVERSATION_MESSAGES"
	| "GENERATE_ITINERARY"
	| "ITINERARY_GENERATED";
