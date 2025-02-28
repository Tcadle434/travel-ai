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
    origin: ['http://localhost:3000'], // Allow your Next.js app
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger('WebsocketGateway');
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  // Map to store response handlers by requestId
  private responseHandlers = new Map<string, (data: any) => void>();

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

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      userId: string;
      content: string;
    },
  ) {
    try {
      const { conversationId, userId, content } = data;

      // Create a new message
      const message = {
        id: generateId(),
        conversationId,
        content,
        timestamp: new Date(),
      };

      // Publish message to conversation queue
      await this.rabbitmqService.publishMessage(
        QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_UPDATED,
        {
          id: generateId(),
          type: 'CONVERSATION_UPDATED',
          payload: {
            conversationId,
            userId,
            message,
          },
          timestamp: new Date(),
        },
      );

      // Return success to client
      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error('Error sending message', error);
      return {
        success: false,
        error: 'Failed to send message',
      };
    }
  }

  // In apps/api-gateway/src/websocket/websocket.gateway.ts

  // Add these handlers to your existing gateway

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

      return {
        success: true,
        conversation: {
          id: conversationId,
          title: conversationTitle,
          lastMessage: '',
          timestamp: new Date(),
        },
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

      // Instead of direct Redis call, we'll publish to queue and await response
      // For now, we'll mock this with a direct response
      // In a real implementation, you'd wait for response from the conversation service

      // Sample response
      return {
        success: true,
        conversations: [
          // These would come from the database in a real implementation
          {
            id: generateId(),
            title: 'Trip to Japan',
            lastMessage: 'When is the best time to visit Tokyo?',
            timestamp: new Date(Date.now() - 86400000),
          },
          {
            id: generateId(),
            title: 'European Vacation',
            lastMessage: 'I would recommend visiting Italy in May.',
            timestamp: new Date(Date.now() - 172800000),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Error getting conversations', error);
      return { success: false, error: 'Failed to get conversations' };
    }
  }

  @SubscribeMessage('switch_conversation')
  async handleSwitchConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; conversationId: string },
  ) {
    try {
      const { userId, conversationId } = data;

      // Here you'd typically fetch the conversation history from your database
      // For now, we'll just confirm the switch was received

      return {
        success: true,
        conversationId,
      };
    } catch (error) {
      this.logger.error('Error switching conversation', error);
      return { success: false, error: 'Failed to switch conversation' };
    }
  }

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

            case 'GET_CONVERSATIONS':
            case 'CONVERSATION_TITLE_UPDATED':
            case 'CONVERSATION_CREATED':
            case 'CONVERSATION_LISTED':
            case 'CONVERSATION_SWITCHED':
            case 'CONVERSATION_MESSAGES':
              if (
                payload.requestId &&
                this.responseHandlers.has(payload.requestId)
              ) {
                const handler = this.responseHandlers.get(payload.requestId);
                if (handler) {
                  handler(payload.data || payload);
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
