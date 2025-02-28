// src/services/mongodb.service.ts
import { MongoClient, Db, Collection } from "mongodb";

export class MongoDBService {
	private client: MongoClient;
	private db!: Db;
	private conversations!: Collection;
	private messages!: Collection;

	constructor() {
		const uri = process.env.MONGODB_URI || "mongodb://root:example@localhost:27017";
		const dbName = process.env.MONGODB_DB_NAME || "travel_ai";

		this.client = new MongoClient(uri);
	}

	async connect(): Promise<void> {
		await this.client.connect();
		console.log("Connected to MongoDB");

		this.db = this.client.db(process.env.MONGODB_DB_NAME || "travel_ai");
		this.conversations = this.db.collection("conversations");
		this.messages = this.db.collection("messages");

		// Create indexes
		await this.conversations.createIndex({ userId: 1 });
		await this.messages.createIndex({ conversationId: 1 });
		await this.messages.createIndex({ timestamp: 1 });
	}

	async disconnect(): Promise<void> {
		await this.client.close();
		console.log("Disconnected from MongoDB");
	}

	// Conversation management
	async createConversation(conversation: any): Promise<string> {
		const result = await this.conversations.insertOne(conversation);
		return result.insertedId.toString();
	}

	async getUserConversations(userId: string): Promise<any[]> {
		return this.conversations.find({ userId }).sort({ updatedAt: -1 }).toArray();
	}

	async getConversation(conversationId: string): Promise<any> {
		return this.conversations.findOne({ id: conversationId });
	}

	async updateConversation(conversationId: string, updates: any): Promise<boolean> {
		const result = await this.conversations.updateOne(
			{ id: conversationId },
			{ $set: { ...updates, updatedAt: new Date() } }
		);
		return result.modifiedCount > 0;
	}

	// Message management
	async storeMessage(message: any): Promise<string> {
		const result = await this.messages.insertOne(message);
		return result.insertedId.toString();
	}

	async getConversationMessages(conversationId: string): Promise<any[]> {
		return this.messages.find({ conversationId }).sort({ timestamp: 1 }).toArray();
	}
}
