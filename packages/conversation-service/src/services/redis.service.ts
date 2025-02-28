// src/services/redis.service.ts
import { createClient, RedisClientType } from "redis";

export class RedisService {
	private client: RedisClientType;

	constructor() {
		const url = process.env.REDIS_URL || "redis://localhost:6379";
		this.client = createClient({ url });

		this.client.on("error", (err) => {
			console.error("Redis client error", err);
		});
	}

	async connect(): Promise<void> {
		await this.client.connect();
		console.log("Connected to Redis");
	}

	async disconnect(): Promise<void> {
		await this.client.disconnect();
	}

	/**
	 * Store conversation history
	 */
	async storeConversationHistory(conversationId: string, messages: any[]): Promise<void> {
		const key = `conversation:${conversationId}:history`;
		await this.client.set(key, JSON.stringify(messages));
		// Set expiration to 1 day (86400 seconds)
		await this.client.expire(key, 86400);
	}

	/**
	 * Retrieve conversation history
	 */
	async getConversationHistory(conversationId: string): Promise<any[]> {
		const key = `conversation:${conversationId}:history`;
		const data = await this.client.get(key);

		if (!data) {
			return [];
		}

		return JSON.parse(data);
	}

	/**
	 * Store user travel parameters
	 */
	async storeTravelParameters(conversationId: string, parameters: any): Promise<void> {
		const key = `conversation:${conversationId}:parameters`;
		await this.client.set(key, JSON.stringify(parameters));
		// Set expiration to 1 day
		await this.client.expire(key, 86400);
	}

	/**
	 * Retrieve user travel parameters
	 */
	async getTravelParameters(conversationId: string): Promise<any> {
		const key = `conversation:${conversationId}:parameters`;
		const data = await this.client.get(key);

		if (!data) {
			return {};
		}

		return JSON.parse(data);
	}

	/**
	 * Store a conversation
	 */
	async storeConversation(conversation: any): Promise<void> {
		const key = `user:${conversation.userId}:conversations`;

		// Get existing conversations
		const existingData = await this.client.get(key);
		let conversations = existingData ? JSON.parse(existingData) : [];

		// Check if conversation already exists
		const existingIndex = conversations.findIndex((c: any) => c.id === conversation.id);
		if (existingIndex >= 0) {
			// Update existing
			conversations[existingIndex] = conversation;
		} else {
			// Add new
			conversations.push(conversation);
		}

		// Store updated list
		await this.client.set(key, JSON.stringify(conversations));

		// Set expiration to 30 days
		await this.client.expire(key, 30 * 86400);

		// Also store individual conversation
		const convKey = `conversation:${conversation.id}`;
		await this.client.set(convKey, JSON.stringify(conversation));
		await this.client.expire(convKey, 30 * 86400);
	}

	/**
	 * Get user's conversations
	 */
	async getUserConversations(userId: string): Promise<any[]> {
		const key = `user:${userId}:conversations`;
		const data = await this.client.get(key);

		if (!data) {
			return [];
		}

		return JSON.parse(data);
	}

	/**
	 * Get a conversation by ID
	 */
	async getConversation(conversationId: string): Promise<any | null> {
		const key = `conversation:${conversationId}`;
		const data = await this.client.get(key);

		if (!data) {
			return null;
		}

		return JSON.parse(data);
	}

	/**
	 * Update conversation title
	 */
	async updateConversationTitle(conversationId: string, title: string): Promise<boolean> {
		const key = `conversation:${conversationId}`;
		const data = await this.client.get(key);

		if (!data) {
			return false;
		}

		const conversation = JSON.parse(data);
		conversation.title = title;
		conversation.updatedAt = new Date();

		await this.client.set(key, JSON.stringify(conversation));

		// Also update in user's conversation list
		const userKey = `user:${conversation.userId}:conversations`;
		const userData = await this.client.get(userKey);

		if (userData) {
			const conversations = JSON.parse(userData);
			const index = conversations.findIndex((c: any) => c.id === conversationId);

			if (index >= 0) {
				conversations[index].title = title;
				conversations[index].updatedAt = new Date();
				await this.client.set(userKey, JSON.stringify(conversations));
			}
		}

		return true;
	}

	/**
	 * Update last message
	 */
	async updateLastMessage(conversationId: string, message: string): Promise<boolean> {
		const key = `conversation:${conversationId}`;
		const data = await this.client.get(key);

		if (!data) {
			return false;
		}

		const conversation = JSON.parse(data);
		conversation.lastMessage = message;
		conversation.updatedAt = new Date();

		await this.client.set(key, JSON.stringify(conversation));

		// Also update in user's conversation list
		const userKey = `user:${conversation.userId}:conversations`;
		const userData = await this.client.get(userKey);

		if (userData) {
			const conversations = JSON.parse(userData);
			const index = conversations.findIndex((c: any) => c.id === conversationId);

			if (index >= 0) {
				conversations[index].lastMessage = message;
				conversations[index].updatedAt = new Date();
				await this.client.set(userKey, JSON.stringify(conversations));
			}
		}

		return true;
	}
}
