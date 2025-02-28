// apps/api-gateway/src/rabbitmq/rabbitmq.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { QUEUE_CONFIG, QueueMessage } from '@travel-ai/shared';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Connect to RabbitMQ
      const rabbitmqUrl =
        this.configService.get('RABBITMQ_URL') || QUEUE_CONFIG.RABBITMQ_URL;
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Setup exchange
      await this.channel.assertExchange(
        QUEUE_CONFIG.EXCHANGES.TRAVEL,
        'topic',
        { durable: true },
      );

      // Setup queues
      await this.channel.assertQueue(QUEUE_CONFIG.QUEUES.CONVERSATION, {
        durable: true,
      });
      await this.channel.assertQueue(QUEUE_CONFIG.QUEUES.ITINERARY_GENERATION, {
        durable: true,
      });
      await this.channel.assertQueue(QUEUE_CONFIG.QUEUES.NOTIFICATION, {
        durable: true,
      });

      // Bind all routing keys for the conversation queue
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
          key,
        );
      }

      // Bind itinerary routing key
      await this.channel.bindQueue(
        QUEUE_CONFIG.QUEUES.ITINERARY_GENERATION,
        QUEUE_CONFIG.EXCHANGES.TRAVEL,
        QUEUE_CONFIG.ROUTING_KEYS.GENERATE_ITINERARY,
      );

      // Bind all routing keys for the notification queue
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
          key,
        );
      }

      console.log('RabbitMQ connection established successfully');
    } catch (error) {
      console.error('Failed to initialize RabbitMQ connection', error);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      console.error('Error closing RabbitMQ connection', error);
    }
  }

  async publishMessage(
    routingKey: string,
    message: QueueMessage,
  ): Promise<boolean> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }

      console.log(`Publishing message with routing key: ${routingKey}`);
      console.log(`Message type: ${message.type}`);

      await this.channel.publish(
        QUEUE_CONFIG.EXCHANGES.TRAVEL,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true },
      );

      return true;
    } catch (error) {
      console.error(`Error publishing message to ${routingKey}`, error);
      return false;
    }
  }

  async consumeMessages(
    queue: string,
    callback: (message: QueueMessage) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    console.log(`Starting to consume messages from queue: ${queue}`);

    await this.channel.consume(
      queue,
      async (message) => {
        if (message) {
          try {
            const parsedMessage = JSON.parse(
              message.content.toString(),
            ) as QueueMessage;
            console.log(`Received message of type: ${parsedMessage.type}`);
            await callback(parsedMessage);
            this.channel.ack(message);
          } catch (error) {
            console.error(`Error processing message from ${queue}`, error);
            this.channel.nack(message, false, false); // Don't requeue on error
          }
        }
      },
      { noAck: false },
    );
  }
}
