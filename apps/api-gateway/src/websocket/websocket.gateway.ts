// apps/api-gateway/src/websocket/websocket.gateway.ts
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

      // Invalidate user conversations cache
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
              content: message,
              timestamp: new Date(),
            },
          },
          timestamp: new Date(),
        },
      );

      // Invalidate conversation cache
      await this.cacheService.invalidateConversationCache(conversationId);

      // Invalidate user conversations cache
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
                await this.sendToUser(
                  payload.userId,
                  'message_received',
                  payload.assistantMessage,
                );
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
}
