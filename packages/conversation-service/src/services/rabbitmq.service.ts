// packages/conversation-service/src/services/rabbitmq.service.ts
import * as amqp from "amqplib";
import { QUEUE_CONFIG, QueueMessage } from "@travel-ai/shared";

export class RabbitMQService {
	private connection: amqp.Connection | null = null;
	private channel: amqp.Channel | null = null;

	async connect(): Promise<void> {
		try {
			const url = process.env.RABBITMQ_URL || QUEUE_CONFIG.RABBITMQ_URL;
			this.connection = await amqp.connect(url);
			this.channel = await this.connection.createChannel();

			// Setup exchange
			await this.channel.assertExchange(QUEUE_CONFIG.EXCHANGES.TRAVEL, "topic", {
				durable: true,
			});

			// Setup queues
			await this.channel.assertQueue(QUEUE_CONFIG.QUEUES.CONVERSATION, { durable: true });
			await this.channel.assertQueue(QUEUE_CONFIG.QUEUES.NOTIFICATION, { durable: true });
			await this.channel.assertQueue(QUEUE_CONFIG.QUEUES.ITINERARY_GENERATION, {
				durable: true,
			});

			// Bind all routing keys to their respective queues
			const conversationRoutingKeys = [
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_UPDATED,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_CREATED,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_LISTED,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_MESSAGES,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_TITLE_UPDATED,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_SWITCHED,
			];

			for (const key of conversationRoutingKeys) {
				await this.channel.bindQueue(
					QUEUE_CONFIG.QUEUES.CONVERSATION,
					QUEUE_CONFIG.EXCHANGES.TRAVEL,
					key
				);
			}

			// Bind routing keys to notification queue
			const notificationRoutingKeys = [
				QUEUE_CONFIG.ROUTING_KEYS.NOTIFICATION,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_UPDATED,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_LISTED,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_MESSAGES,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_TITLE_UPDATED,
				QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_SWITCHED,
				QUEUE_CONFIG.ROUTING_KEYS.ITINERARY_GENERATED,
			];

			for (const key of notificationRoutingKeys) {
				await this.channel.bindQueue(
					QUEUE_CONFIG.QUEUES.NOTIFICATION,
					QUEUE_CONFIG.EXCHANGES.TRAVEL,
					key
				);
			}

			console.log("RabbitMQ connected and initialized");
		} catch (error) {
			console.error("Failed to connect to RabbitMQ", error);
			throw error;
		}
	}

	async publishMessage(routingKey: string, message: QueueMessage): Promise<boolean> {
		try {
			if (!this.channel) {
				throw new Error("RabbitMQ channel not initialized");
			}

			console.log(
				`Publishing message with routing key: ${routingKey}, type: ${message.type}`
			);

			await this.channel.publish(
				QUEUE_CONFIG.EXCHANGES.TRAVEL,
				routingKey,
				Buffer.from(JSON.stringify(message)),
				{ persistent: true }
			);

			return true;
		} catch (error) {
			console.error(`Error publishing message to ${routingKey}`, error);
			return false;
		}
	}

	async consumeMessages(
		queue: string,
		callback: (message: QueueMessage) => Promise<void>
	): Promise<void> {
		if (!this.channel) {
			throw new Error("RabbitMQ channel not initialized");
		}

		console.log(`Started consuming messages from queue: ${queue}`);

		await this.channel.consume(
			queue,
			async (message) => {
				if (message) {
					try {
						const parsedMessage = JSON.parse(
							message.content.toString()
						) as QueueMessage;
						console.log(`Received message type: ${parsedMessage.type}`);
						await callback(parsedMessage);
						this.channel?.ack(message);
					} catch (error) {
						console.error(`Error processing message from ${queue}`, error);
						this.channel?.nack(message, false, false); // Don't requeue on error
					}
				}
			},
			{ noAck: false }
		);
	}

	async disconnect(): Promise<void> {
		try {
			if (this.channel) {
				await this.channel.close();
			}
			if (this.connection) {
				await this.connection.close();
			}
		} catch (error) {
			console.error("Error disconnecting from RabbitMQ", error);
		}
	}
}
