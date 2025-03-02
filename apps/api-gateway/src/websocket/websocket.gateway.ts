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
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(private readonly rabbitmqService: RabbitmqService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Wait a moment for RabbitMQ to initialize before consuming messages
    setTimeout(() => {
      this.consumeNotifications();
    }, 1000);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove user from userSockets map
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('identify')
  handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    if (userId) {
      this.userSockets.set(userId, client.id);
      this.logger.log(`User ${userId} identified with socket ${client.id}`);
      return { success: true };
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

  @SubscribeMessage('get_conversations')
  async handleGetConversations(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      const { userId } = data;

      // Create a unique request ID for this query
      const requestId = generateId();

      // Set up a promise to wait for the response
      const responsePromise = new Promise((resolve, reject) => {
        // Set a timeout for the response
        const timeout = setTimeout(() => {
          reject(new Error('Request timed out'));
          this.responseHandlers.delete(requestId);
        }, 15000);

        // Store the handler
        this.responseHandlers.set(requestId, (data: any) => {
          clearTimeout(timeout);
          resolve(data);
          this.responseHandlers.delete(requestId);
        });
      });

      // Publish the request
      await this.rabbitmqService.publishMessage(
        QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_LISTED,
        {
          id: requestId,
          type: 'GET_CONVERSATIONS',
          payload: {
            userId,
            requestId,
          },
          timestamp: new Date(),
        },
      );

      // Wait for the response
      const conversationsData = await responsePromise;
      return {
        success: true,
        conversations: conversationsData,
      };
    } catch (error) {
      this.logger.error('Error getting conversations', error);
      return { success: false, error: 'Failed to get conversations' };
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

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.logger.error('Error sending message', error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  // Map to store response handlers by requestId
  private responseHandlers = new Map<string, (data: any) => void>();

  // Method to send a message to a specific user
  sendToUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
      return true;
    }
    return false;
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
                this.sendToUser(
                  payload.userId,
                  'message_received',
                  payload.assistantMessage,
                );
              }
              break;

            case 'CONVERSATION_RESPONSE':
            case 'GET_CONVERSATIONS':
            case 'CONVERSATION_LISTED':
              // This is a response to a specific request
              if (
                payload.requestId &&
                this.responseHandlers.has(payload.requestId)
              ) {
                const handler = this.responseHandlers.get(payload.requestId);
                if (handler) {
                  handler(payload.data);
                }
              }
              break;

            case 'ITINERARY_GENERATED':
              if (payload.userId) {
                this.sendToUser(
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
