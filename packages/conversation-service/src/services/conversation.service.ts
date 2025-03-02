// src/services/conversation.service.ts
import { RabbitMQService } from "./rabbitmq.service";
import { AIService } from "./ai.service";
import { RedisService } from "./redis.service";
import { MongoDBService } from "./mongodb.service";
import { QUEUE_CONFIG, generateId } from "@travel-ai/shared";

export class ConversationService {
	constructor(
		private readonly rabbitMQService: RabbitMQService,
		private readonly aiService: AIService,
		private readonly redisService: RedisService,
		private readonly mongoDBService: MongoDBService
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

			// Store user message in MongoDB
			const userMessage = {
				id: message.id || generateId(),
				conversationId,
				userId,
				role: "user",
				content: message.content,
				timestamp: message.timestamp || new Date(),
			};

			await this.mongoDBService.storeMessage(userMessage);

			// Update conversation's last message
			await this.mongoDBService.updateConversation(conversationId, {
				lastMessage: message.content,
				updatedAt: new Date(),
			});

			// Retrieve conversation history from MongoDB
			let conversationHistory =
				await this.mongoDBService.getConversationMessages(conversationId);

			// Format messages for AI service
			const formattedHistory = conversationHistory.map((msg) => ({
				role: msg.role,
				content: msg.content,
			}));

			// Generate AI response
			const responseContent = await this.aiService.generateResponse(formattedHistory);

			// Create assistant message
			const assistantMessage = {
				id: generateId(),
				conversationId,
				userId,
				role: "assistant",
				content: responseContent,
				timestamp: new Date(),
			};

			// Store assistant message in MongoDB
			await this.mongoDBService.storeMessage(assistantMessage);

			// Update conversation's last message with AI response
			await this.mongoDBService.updateConversation(conversationId, {
				lastMessage: responseContent,
				updatedAt: new Date(),
			});

			// Extract travel parameters
			const extractedParameters =
				await this.aiService.extractTravelParameters(formattedHistory);

			// Store travel parameters if any were extracted
			if (Object.keys(extractedParameters).length > 0) {
				// Store in Redis for quick access
				await this.redisService.storeTravelParameters(conversationId, extractedParameters);
			}

			// Send the response back to the notification queue
			await this.rabbitMQService.publishMessage(
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_UPDATED,
				{
					id: generateId(),
					type: "CONVERSATION_UPDATED",
					payload: {
						userId,
						conversationId,
						assistantMessage: {
							id: assistantMessage.id,
							conversationId,
							content: assistantMessage.content,
							timestamp: assistantMessage.timestamp,
						},
					},
					timestamp: new Date(),
				}
			);

			console.log("AI response sent back to notification queue");
		} catch (error) {
			console.error(`Error handling message from user ${userId}`, error);
		}
	}

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

			await this.mongoDBService.createConversation(conversation);

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
	async getUserConversations(payload: any): Promise<void> {
		const { userId, requestId } = payload;

		try {
			// Get conversations from MongoDB
			const conversations = await this.mongoDBService.getUserConversations(userId);

			// Send response back to notification queue
			await this.rabbitMQService.publishMessage(
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_RESPONSE,
				{
					id: generateId(),
					type: "CONVERSATION_RESPONSE",
					payload: {
						requestId,
						data: conversations,
					},
					timestamp: new Date(),
				}
			);

			console.log(`Retrieved ${conversations.length} conversations for user ${userId}`);
		} catch (error) {
			console.error(`Error getting conversations for user ${userId}`, error);

			// Send error response
			await this.rabbitMQService.publishMessage(
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_RESPONSE,
				{
					id: generateId(),
					type: "CONVERSATION_RESPONSE",
					payload: {
						requestId,
						error: "Failed to get conversations",
					},
					timestamp: new Date(),
				}
			);
		}
	}

	/**
	 * Get conversation messages
	 */
	async getConversationMessages(payload: any): Promise<void> {
		const { userId, conversationId, requestId } = payload;

		try {
			// Get messages from MongoDB
			const messages = await this.mongoDBService.getConversationMessages(conversationId);
			console.log("messages", messages);

			// Send response back to notification queue
			await this.rabbitMQService.publishMessage(
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_RESPONSE,
				{
					id: generateId(),
					type: "CONVERSATION_RESPONSE",
					payload: {
						requestId,
						data: messages,
					},
					timestamp: new Date(),
				}
			);

			console.log(`Retrieved ${messages.length} messages for conversation ${conversationId}`);
		} catch (error) {
			console.error(`Error getting messages for conversation ${conversationId}`, error);

			// Send error response
			await this.rabbitMQService.publishMessage(
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_RESPONSE,
				{
					id: generateId(),
					type: "CONVERSATION_RESPONSE",
					payload: {
						requestId,
						error: "Failed to get conversation messages",
					},
					timestamp: new Date(),
				}
			);
		}
	}
}
