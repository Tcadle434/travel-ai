// packages/conversation-service/src/index.ts
import * as dotenv from "dotenv";
import { RabbitMQService } from "./services/rabbitmq.service";
import { ConversationService } from "./services/conversation.service";
import { AIService } from "./services/ai.service";
import { RedisService } from "./services/redis.service";
import { MongoDBService } from "./services/mongodb.service";
import { QUEUE_CONFIG } from "@travel-ai/shared";

// Load environment variables
dotenv.config();

async function bootstrap() {
	try {
		console.log("Starting Conversation Service...");

		// Initialize MongoDB
		const mongoDBService = new MongoDBService();
		await mongoDBService.connect();

		// Initialize Redis service
		const redisService = new RedisService();
		await redisService.connect();

		// Initialize RabbitMQ service
		const rabbitMQService = new RabbitMQService();
		await rabbitMQService.connect();
		console.log("Connected to RabbitMQ");

		// Initialize AI service
		const aiService = new AIService();
		console.log("AI Service initialized");

		// Initialize Conversation service
		const conversationService = new ConversationService(
			rabbitMQService,
			aiService,
			redisService,
			mongoDBService
		);

		// Set up the consumer for different message types
		await rabbitMQService.consumeMessages(QUEUE_CONFIG.QUEUES.CONVERSATION, async (message) => {
			switch (message.type) {
				case "CONVERSATION_UPDATED":
					await conversationService.handleUserMessage(message.payload);
					break;

				case "CONVERSATION_CREATED":
					await conversationService.createConversation(message.payload);
					break;

				case "GET_CONVERSATIONS":
					await conversationService.getUserConversations(message.payload);
					break;

				case "GET_CONVERSATION_MESSAGES":
					await conversationService.getConversationMessages(message.payload);
					break;

				default:
					console.log(`Unknown message type: ${message.type}`);
			}
		});

		console.log("Conversation Service is running and listening for messages");

		// Keep the service running
		process.on("SIGINT", async () => {
			console.log("Shutting down Conversation Service...");
			await rabbitMQService.disconnect();
			await redisService.disconnect();
			await mongoDBService.disconnect();
			process.exit(0);
		});
	} catch (error) {
		console.error("Failed to start Conversation Service", error);
		process.exit(1);
	}
}

bootstrap();
