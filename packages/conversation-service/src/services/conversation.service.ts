// src/services/conversation.service.ts
import { RabbitMQService } from "./rabbitmq.service";
import { AIService } from "./ai.service";
import { RedisService } from "./redis.service";
import { QUEUE_CONFIG, generateId } from "@travel-ai/shared";

export class ConversationService {
	constructor(
		private readonly rabbitMQService: RabbitMQService,
		private readonly aiService: AIService,
		private readonly redisService: RedisService
	) {}

	/**
	 * Handle a user message and generate a response
	 */
	async handleUserMessage(payload: any): Promise<void> {
		const { conversationId, userId, message } = payload;

		try {
			console.log(`Received payload for user ${userId} in conversation ${conversationId}`);

			// Validate that we have a proper message
			if (!message || !message.content) {
				console.log("No valid message content found in payload, skipping processing");
				return;
			}

			console.log(`Processing message: ${message.content}`);

			// Retrieve conversation history from Redis
			let conversationHistory =
				await this.redisService.getConversationHistory(conversationId);

			// Add the current message to history
			const userMessage = {
				role: "user",
				content: message.content,
			};

			conversationHistory.push(userMessage);

			// Generate AI response
			const responseContent = await this.aiService.generateResponse(conversationHistory);

			// Add the AI response to conversation history
			const assistantHistoryMessage = {
				role: "assistant",
				content: responseContent,
			};

			conversationHistory.push(assistantHistoryMessage);

			// Store updated conversation history
			await this.redisService.storeConversationHistory(conversationId, conversationHistory);

			if (message && message.content) {
				await this.redisService.updateLastMessage(conversationId, message.content);
			}

			// Extract travel parameters
			const extractedParameters =
				await this.aiService.extractTravelParameters(conversationHistory);

			// Store or update travel parameters
			if (Object.keys(extractedParameters).length > 0) {
				const existingParameters =
					await this.redisService.getTravelParameters(conversationId);
				const mergedParameters = { ...existingParameters, ...extractedParameters };
				await this.redisService.storeTravelParameters(conversationId, mergedParameters);
				console.log("Updated travel parameters:", mergedParameters);
			}

			// Create assistant message for response
			const assistantMessage = {
				id: generateId(),
				conversationId,
				content: responseContent,
				timestamp: new Date(),
			};

			// Send the response back to the notification queue
			await this.rabbitMQService.publishMessage(
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_UPDATED,
				{
					id: generateId(),
					type: "CONVERSATION_UPDATED",
					payload: {
						userId,
						conversationId,
						assistantMessage,
					},
					timestamp: new Date(),
				}
			);

			console.log("AI response sent back to notification queue");
		} catch (error) {
			console.error(`Error handling message from user ${userId}`, error);
		}
	}

	// In packages/conversation-service/src/services/conversation.service.ts

	// Add these methods to your ConversationService

	/**
	 * Create a new conversation
	 */
	async createConversation(payload: any): Promise<void> {
		const { conversationId, userId, title, createdAt } = payload;

		try {
			// Create conversation object
			const conversation = {
				id: conversationId,
				userId,
				title,
				lastMessage: "",
				createdAt: new Date(createdAt),
				updatedAt: new Date(createdAt),
			};

			// Store in Redis
			await this.redisService.storeConversation(conversation);

			console.log(`Created conversation ${conversationId} for user ${userId}`);
		} catch (error) {
			console.error(`Error creating conversation for user ${userId}`, error);
		}
	}

	/**
	 * Get user conversations
	 */
	async getUserConversations(userId: string): Promise<any[]> {
		try {
			return await this.redisService.getUserConversations(userId);
		} catch (error) {
			console.error(`Error getting conversations for user ${userId}`, error);
			return [];
		}
	}
}
