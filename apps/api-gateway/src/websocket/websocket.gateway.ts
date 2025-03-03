import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { QUEUE_CONFIG, QueueMessage, generateId } from '@travel-ai/shared';
import { RedisService } from '../redis/redis.service';
import { RedisCacheService } from '../redis/redis-cache.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger('WebsocketGateway');
  private readonly USER_SOCKET_PREFIX = 'socket:user:';
  private readonly SOCKET_USER_PREFIX = 'socket:id:';
  private readonly SOCKET_TTL = 86400; // 1 day in seconds
  private readonly SENT_MESSAGE_PREFIX = 'sent:message:';
  private readonly SENT_MESSAGE_TTL = 60; // 1 minute in seconds

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly redisService: RedisService,
    private readonly cacheService: RedisCacheService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Wait a moment for RabbitMQ to initialize before consuming messages
    setTimeout(() => {
      this.consumeNotifications();
    }, 1000);
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    try {
      // Get userId from Redis
      const userId = await this.redisService.get(
        `${this.SOCKET_USER_PREFIX}${client.id}`,
      );

      if (userId) {
        // Remove user-socket mapping from Redis
        await this.redisService.del(`${this.USER_SOCKET_PREFIX}${userId}`);
        await this.redisService.del(`${this.SOCKET_USER_PREFIX}${client.id}`);
        this.logger.log(`User mapping removed for socket: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Error removing socket mapping: ${error.message}`,
        error.stack,
      );
    }
  }

  @SubscribeMessage('identify')
  async handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    if (userId) {
      try {
        // Store user-socket mapping in Redis
        await this.redisService.set(
          `${this.USER_SOCKET_PREFIX}${userId}`,
          client.id,
          this.SOCKET_TTL,
        );

        // Store socket-user mapping for reverse lookup
        await this.redisService.set(
          `${this.SOCKET_USER_PREFIX}${client.id}`,
          userId,
          this.SOCKET_TTL,
        );

        this.logger.log(`User ${userId} identified with socket ${client.id}`);
        return { success: true };
      } catch (error) {
        this.logger.error(
          `Error identifying user: ${error.message}`,
          error.stack,
        );
        return { success: false, error: 'Failed to identify user' };
      }
    }
    return { success: false, error: 'No userId provided' };
  }

  @SubscribeMessage('create_conversation')
  async handleCreateConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; title?: string },
  ) {
    try {
      const { userId, title } = data;
      const conversationId = generateId();

      // Create initial title if none provided
      const conversationTitle = title || 'New Travel Plan';

      // Publish to queue
      await this.rabbitmqService.publishMessage(
        QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_CREATED,
        {
          id: generateId(),
          type: 'CONVERSATION_CREATED',
          payload: {
            conversationId,
            userId,
            title: conversationTitle,
            createdAt: new Date(),
          },
          timestamp: new Date(),
        },
      );

      // Wait for conversation to be created
      // In a production system, we might use a request-response pattern here
      await new Promise((resolve) => setTimeout(resolve, 300));

      await this.cacheService.invalidateUserConversationsCache(userId);

      return {
        success: true,
        conversationId,
        title: conversationTitle,
      };
    } catch (error) {
      this.logger.error('Error creating conversation', error);
      return { success: false, error: 'Failed to create conversation' };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { userId: string; conversationId: string; message: string },
  ) {
    try {
      const { userId, conversationId, message } = data;
      const messageId = generateId();

      // Check if this message might be requesting an itinerary
      const isItineraryRequest = this.isItineraryRequest(message);

      // Modify the message to request multiple itineraries if it seems like an itinerary request
      const enhancedMessage = isItineraryRequest
        ? this.enhanceMessageForMultipleItineraries(message)
        : message;

      // Publish to queue
      await this.rabbitmqService.publishMessage(
        QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_UPDATED,
        {
          id: generateId(),
          type: 'CONVERSATION_UPDATED',
          payload: {
            conversationId,
            userId,
            message: {
              id: messageId,
              content: enhancedMessage,
              timestamp: new Date(),
            },
            generateMultipleItineraries: isItineraryRequest,
          },
          timestamp: new Date(),
        },
      );

      await this.cacheService.invalidateConversationCache(conversationId);
      await this.cacheService.invalidateUserConversationsCache(userId);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.logger.error('Error sending message', error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { userId: string; conversationId: string; isTyping: boolean },
  ) {
    try {
      const { userId, conversationId, isTyping } = data;

      if (isTyping) {
        // Set typing indicator in Redis
        await this.cacheService.setTypingIndicator(conversationId, userId);

        // Broadcast typing event to other users in the conversation
        // In a real app, we would determine who else is in the conversation
        // For now, we broadcast to all clients except the sender
        client.broadcast.emit('typing_indicator', {
          conversationId,
          userId,
          isTyping: true,
        });
      } else {
        // Remove typing indicator
        await this.redisService.del(`typing:${conversationId}`);

        // Broadcast typing stopped event
        client.broadcast.emit('typing_indicator', {
          conversationId,
          userId,
          isTyping: false,
        });
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error handling typing indicator', error);
      return { success: false, error: 'Failed to update typing status' };
    }
  }

  // Method to send a message to a specific user
  async sendToUser(userId: string, event: string, data: any) {
    try {
      // Check if this message has already been sent (deduplication)
      if (data.id) {
        const messageKey = `${this.SENT_MESSAGE_PREFIX}${userId}:${data.id}`;
        const alreadySent = await this.redisService.exists(messageKey);

        if (alreadySent) {
          this.logger.warn(`Duplicate message detected, skipping: ${data.id}`);
          return false;
        }

        // Mark this message as sent
        await this.redisService.set(messageKey, 'sent', this.SENT_MESSAGE_TTL);
      }

      // Get socket ID from Redis
      const socketId = await this.redisService.get(
        `${this.USER_SOCKET_PREFIX}${userId}`,
      );

      if (socketId) {
        this.server.to(socketId).emit(event, data);
        this.logger.debug(`Sent ${event} to user ${userId}`);
        return true;
      }

      this.logger.warn(`No socket found for user: ${userId}`);
      return false;
    } catch (error) {
      this.logger.error(
        `Error sending to user ${userId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  // Consume notification messages from RabbitMQ
  private async consumeNotifications() {
    try {
      await this.rabbitmqService.consumeMessages(
        QUEUE_CONFIG.QUEUES.NOTIFICATION,
        async (message: QueueMessage) => {
          this.logger.log(`Received notification: ${message.type}`);

          const { payload } = message;

          // Handle different types of notifications
          switch (message.type) {
            case 'CONVERSATION_UPDATED':
              if (payload.userId && payload.assistantMessage) {
                // Check if this is a large message that might be an itinerary
                const content = payload.assistantMessage.content;
                const isLargeMessage = content && content.length > 4000;
                const containsItineraryMarkers =
                  content &&
                  (content.includes('# Itinerary 1') ||
                    content.includes('Itinerary 1:'));

                if (isLargeMessage && containsItineraryMarkers) {
                  this.logger.log(
                    'Large itinerary message detected, sending in chunks',
                  );

                  // First, send a notification that we're processing itineraries
                  await this.sendToUser(payload.userId, 'message_received', {
                    id: `${payload.assistantMessage.id}-part-0`,
                    content:
                      "I'm preparing your itineraries. This might take a moment...",
                    timestamp: new Date(),
                  });

                  // Split the content into chunks to ensure complete delivery
                  const chunks = this.splitContentIntoChunks(content);

                  // Send each chunk as a separate message
                  for (let i = 0; i < chunks.length; i++) {
                    await this.sendToUser(payload.userId, 'message_received', {
                      id: `${payload.assistantMessage.id}-part-${i + 1}`,
                      content: chunks[i],
                      timestamp: new Date(),
                      isItineraryPart: true,
                      partNumber: i + 1,
                      totalParts: chunks.length,
                    });

                    // Add a small delay between chunks to ensure order
                    await new Promise((resolve) => setTimeout(resolve, 300));
                  }

                  // Send a final complete message with all content for processing
                  await this.sendToUser(payload.userId, 'itinerary_complete', {
                    id: `${payload.assistantMessage.id}-complete`,
                    content: content,
                    timestamp: new Date(),
                  });
                } else {
                  // Regular message, send as is
                  await this.sendToUser(
                    payload.userId,
                    'message_received',
                    payload.assistantMessage,
                  );
                }
              }
              break;

            case 'ITINERARY_GENERATED':
              if (payload.userId) {
                await this.sendToUser(
                  payload.userId,
                  'itinerary_generated',
                  payload.itinerary,
                );
              }
              break;

            default:
              this.logger.warn(`Unknown notification type: ${message.type}`);
          }
        },
      );
      this.logger.log('Started consuming notification messages');
    } catch (error) {
      this.logger.error('Failed to consume notification messages', error);
    }
  }

  // Helper method to split content into manageable chunks
  private splitContentIntoChunks(content: string): string[] {
    // If content is small enough, return as is
    if (content.length <= 8000) {
      return [content];
    }

    const chunks: string[] = [];

    // Try to split at logical boundaries like itinerary sections
    const itineraryMarkers = [
      '# Itinerary 1',
      '# Itinerary 2',
      '# Itinerary 3',
      'Itinerary 1:',
      'Itinerary 2:',
      'Itinerary 3:',
    ];

    let lastIndex = 0;

    // Find each itinerary section
    for (const marker of itineraryMarkers) {
      const index = content.indexOf(marker, lastIndex);

      if (index !== -1 && index > lastIndex) {
        // Add the content up to this marker
        if (index > lastIndex) {
          chunks.push(content.substring(lastIndex, index));
        }

        lastIndex = index;
      }
    }

    // Add the remaining content
    if (lastIndex < content.length) {
      chunks.push(content.substring(lastIndex));
    }

    // If we couldn't split by markers or only got one chunk, split by size
    if (chunks.length <= 1) {
      chunks.length = 0; // Clear the array

      // Split into chunks of approximately 6000 characters
      // Try to split at paragraph boundaries
      const paragraphs = content.split('\n\n');
      let currentChunk = '';

      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length + 2 > 6000) {
          chunks.push(currentChunk);
          currentChunk = paragraph + '\n\n';
        } else {
          currentChunk += paragraph + '\n\n';
        }
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
    }

    return chunks;
  }

  // Helper method to check if a message is likely requesting an itinerary
  private isItineraryRequest(message: string): boolean {
    const itineraryKeywords = [
      'itinerary',
      'travel plan',
      'trip plan',
      'vacation',
      'holiday',
      'visit',
      'tour',
      'journey',
      'travel to',
      'traveling to',
      'travelling to',
      'plan a trip',
      'plan my trip',
      'plan my vacation',
      'plan my holiday',
    ];

    const lowercaseMessage = message.toLowerCase();
    return itineraryKeywords.some((keyword) =>
      lowercaseMessage.includes(keyword),
    );
  }

  // Helper method to enhance a message to request multiple itineraries
  private enhanceMessageForMultipleItineraries(message: string): string {
    // Check if the message already explicitly asks for multiple options
    const alreadyAsksForMultiple =
      /\b(multiple|several|different|various|3|three)\b.*\b(options|itineraries|plans|suggestions|alternatives)\b/i.test(
        message,
      );

    if (alreadyAsksForMultiple) {
      // Even if they ask for multiple, we still need to enforce our format
      return `${message}

IMPORTANT: You MUST respond with 3 distinct, highly detailed travel itineraries. You MUST follow this EXACT format:

# Itinerary 1: [TITLE]
[Brief overview/introduction - 2-3 sentences]

## Day-by-Day Plan
[Detailed day-by-day breakdown with specific locations, activities, and timing]

## Accommodations
[Specific hotel recommendations with approximate pricing]

## Transportation
[Details on getting around and between locations]

## Estimated Budget
[Breakdown of costs for accommodations, food, activities, and transportation]

## Highlights
[Key attractions and experiences]

# Itinerary 2: [TITLE]
[Follow the same format as above but with different locations/activities/accommodations]

# Itinerary 3: [TITLE]
[Follow the same format as above but with different locations/activities/accommodations]

Each itinerary MUST be completely unique from the others, offering different experiences while still meeting the requirements in the original request. DO NOT cut off your response - you MUST complete all 3 itineraries in full detail.`;
    }

    // Add instruction to generate multiple itineraries with more detailed requirements
    return `${message}

IMPORTANT: You MUST respond with 3 distinct, highly detailed travel itineraries. You MUST follow this EXACT format:

# Itinerary 1: [TITLE]
[Brief overview/introduction - 2-3 sentences]

## Day-by-Day Plan
[Detailed day-by-day breakdown with specific locations, activities, and timing]

## Accommodations
[Specific hotel recommendations with approximate pricing]

## Transportation
[Details on getting around and between locations]

## Estimated Budget
[Breakdown of costs for accommodations, food, activities, and transportation]

## Highlights
[Key attractions and experiences]

# Itinerary 2: [TITLE]
[Follow the same format as above but with different locations/activities/accommodations]

# Itinerary 3: [TITLE]
[Follow the same format as above but with different locations/activities/accommodations]

Each itinerary MUST be completely unique from the others, offering different experiences while still meeting the requirements in the original request. DO NOT cut off your response - you MUST complete all 3 itineraries in full detail.`;
  }
}
