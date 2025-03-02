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

	// Routing keys
	ROUTING_KEYS: {
		CONVERSATION_UPDATED: "conversation.updated",
		CONVERSATION_CREATED: "conversation.created",
		CONVERSATION_LISTED: "conversation.listed",
		CONVERSATION_MESSAGES: "conversation.messages",
		CONVERSATION_RESPONSE: "conversation.response",
		GENERATE_ITINERARY: "itinerary.generate",
		ITINERARY_GENERATED: "itinerary.generated",
		ERROR: "error",
	},
};
