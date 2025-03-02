# Travel AI App Technical Design

## Introduction

This document outlines the technical design of the Travel AI App, a conversational assistant designed to help users plan travel itineraries. It provides detailed information about the implementation of each component, the technologies used, and the design decisions made during development.

## Technology Stack

### Frontend

- **Framework**: Next.js (React)
- **State Management**: React Hooks
- **Styling**: Tailwind CSS
- **Real-time Communication**: Socket.IO client
- **HTTP Client**: Fetch API

### Backend

- **API Gateway**: NestJS
- **Message Broker**: RabbitMQ
- **Databases**:
    - **MongoDB**: Primary persistent storage
    - **Redis**: Caching and real-time features
- **ODM**: Mongoose
- **WebSockets**: Socket.IO server
- **API Documentation**: Swagger/OpenAPI

## Component Design

### API Gateway

The API Gateway serves as the central entry point for all client requests. It is built using NestJS, a progressive Node.js framework for building efficient and scalable server-side applications.

#### Modules

1. **AppModule**: The root module that ties everything together.
2. **WebsocketModule**: Handles real-time communication with clients.
3. **RabbitmqModule**: Manages communication with the RabbitMQ message broker.
4. **ConversationModule**: Provides REST API endpoints for conversation data.
5. **RedisModule**: Manages Redis caching and real-time features.
6. **MongooseModule**: Manages MongoDB connections and schemas.

#### WebSocket Gateway

The WebSocket Gateway handles real-time communication with clients. It uses Socket.IO for WebSocket connections and provides the following functionality:

- User identification
- Real-time message delivery
- Conversation creation
- Error handling

```typescript
@WebSocketGateway({
	cors: {
		origin: process.env.FRONTEND_URL || "http://localhost:3000",
		credentials: true,
	},
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer() server: Server;
	private logger = new Logger("WebsocketGateway");
	private userSockets: Map<string, string> = new Map(); // userId -> socketId

	constructor(
		private readonly rabbitmqService: RabbitmqService,
		private readonly redisService: RedisService
	) {}

	// ... implementation details
}
```

#### REST API Controllers

The REST API controllers provide HTTP endpoints for data retrieval. They use NestJS controllers and services to handle requests and responses.

```typescript
@Controller("conversations")
export class ConversationController {
	private readonly logger = new Logger(ConversationController.name);

	constructor(
		private readonly conversationService: ConversationService,
		private readonly cacheService: RedisCacheService
	) {}

	@Get(":conversationId/messages")
	async getConversationMessages(@Param("conversationId") conversationId: string) {
		// ... implementation details with caching
	}

	@Get()
	async getUserConversations(@Query("userId") userId: string) {
		// ... implementation details with caching
	}
}
```

### Database Services

#### MongoDB Service

The MongoDB service handles all persistent data storage operations:

```typescript
@Injectable()
export class MongoDBService {
	constructor(
		@InjectModel(Message.name) private messageModel: Model<MessageDocument>,
		@InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
		private readonly logger: Logger
	) {
		this.logger = new Logger(MongoDBService.name);
	}

	async storeMessage(message: IMessage): Promise<IMessage> {
		this.logger.log(`Storing message in MongoDB: ${message.id}`);
		const newMessage = new this.messageModel(message);
		await newMessage.save();
		return message;
	}

	async getConversationMessages(conversationId: string): Promise<IMessage[]> {
		this.logger.log(`Getting messages for conversation from MongoDB: ${conversationId}`);
		return this.messageModel.find({ conversationId }).sort({ timestamp: 1 }).lean().exec();
	}

	// ... other MongoDB operations
}
```

#### Redis Cache Service

The Redis cache service implements a read-through and write-through caching strategy:

```typescript
@Injectable()
export class RedisCacheService {
	private readonly logger = new Logger(RedisCacheService.name);

	constructor(
		private readonly redisService: RedisService,
		private readonly mongoDBService: MongoDBService
	) {}

	async getCachedConversationMessages(conversationId: string): Promise<IMessage[] | null> {
		const cacheKey = `messages:${conversationId}`;

		// Try to get from cache first
		const cachedData = await this.redisService.get(cacheKey);
		if (cachedData) {
			this.logger.log(`Cache hit for conversation messages: ${conversationId}`);
			return JSON.parse(cachedData);
		}

		// Cache miss, get from MongoDB
		this.logger.log(`Cache miss for conversation messages: ${conversationId}`);
		const messages = await this.mongoDBService.getConversationMessages(conversationId);

		// Store in cache with TTL
		if (messages.length > 0) {
			await this.redisService.set(
				cacheKey,
				JSON.stringify(messages),
				"EX",
				86400 // 1 day TTL
			);
		}

		return messages;
	}

	// ... other caching methods
}
```

### Conversation Service

The Conversation Service processes user messages, manages conversation state, and integrates with the AI service for generating responses.

#### Message Processing

The Conversation Service processes user messages by:

1. Storing the message in MongoDB
2. Invalidating relevant Redis cache
3. Retrieving the conversation history
4. Generating a response using the AI service
5. Storing the response in MongoDB
6. Updating Redis cache
7. Publishing the response to RabbitMQ

```typescript
async handleUserMessage(payload: any): Promise<void> {
  const { conversationId, userId, message } = payload;

  try {
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

    // Invalidate cache for this conversation
    await this.cacheService.invalidateConversationCache(conversationId);

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

    // Update cache with new message
    await this.cacheService.updateConversationCache(conversationId, assistantMessage);

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
  } catch (error) {
    this.logger.error(`Error handling message from user ${userId}`, error);
    // Implement retry mechanism for critical operations
    if (this.shouldRetry(error)) {
      await this.retryOperation(() => this.handleUserMessage(payload));
    }
  }
}
```

### Frontend Components

The frontend is built using React with a component-based architecture. The main components are:

#### ChatInterface

The ChatInterface component is the main component that orchestrates the chat experience. It manages the state of the application and coordinates the other components.

```typescript
export default function ChatInterface() {
	const [socket, setSocket] = useState<Socket | null>(null);
	const [connected, setConnected] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [typing, setTyping] = useState(false);
	const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// ... implementation details
}
```

#### ChatSidebar

The ChatSidebar component displays the list of conversations and allows the user to switch between them.

```typescript
const ChatSidebar: React.FC<ChatSidebarProps> = ({
	sidebarOpen,
	conversationHistory,
	activeConversationId,
	connected,
	onCreateConversation,
	onSwitchConversation,
}) => {
	// ... implementation details
};
```

#### MessageList

The MessageList component displays the messages in a conversation and handles scrolling to the bottom when new messages arrive.

```typescript
const MessageList: React.FC<MessageListProps> = ({ messages, typing }) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// ... implementation details
};
```

## Data Flow

### User Message Flow

The user message flow is implemented as follows:

1. User sends a message through the MessageInput component
2. ChatInterface component calls the handleSendMessage function
3. handleSendMessage emits a 'send_message' event to the WebSocket server
4. WebSocket Gateway receives the event and publishes a message to RabbitMQ
5. Conversation Service consumes the message and processes it
6. Conversation Service stores the message in MongoDB and invalidates relevant Redis cache
7. Conversation Service generates a response and publishes it to RabbitMQ
8. WebSocket Gateway consumes the response and emits a 'message_received' event
9. ChatInterface component receives the event and updates the messages state
10. MessageList component renders the new message

### Conversation History Retrieval

The conversation history retrieval is implemented as follows:

1. User selects a conversation in the ChatSidebar component
2. ChatSidebar component calls the onSwitchConversation function
3. ChatInterface component calls the handleSwitchConversation function
4. handleSwitchConversation calls the fetchConversationMessages function
5. fetchConversationMessages makes an HTTP request to the API Gateway
6. ConversationController receives the request and calls the cacheService.getCachedConversationMessages function
7. RedisCacheService checks Redis for cached messages
8. If cache hit, return cached messages; if cache miss, query MongoDB and update cache
9. ConversationController returns the messages to the client
10. ChatInterface component updates the messages state
11. MessageList component renders the messages

## Database Optimization

### MongoDB Optimization

1. **Indexing Strategy**:

    - Conversation collection: Indexes on `id`, `userId`, and `updatedAt` fields
    - Message collection: Indexes on `conversationId` and `timestamp` fields

2. **Query Optimization**:

    - Use projection to limit fields returned
    - Use lean queries for better performance
    - Implement pagination for large result sets

3. **Connection Pooling**:
    - Configure appropriate connection pool size
    - Implement connection monitoring and health checks

### Redis Caching Strategy

1. **Cache Types**:

    - **Read-Through Cache**: For conversation messages and user conversations
    - **Session Cache**: For user session data and WebSocket connections
    - **Ephemeral Data**: For typing indicators and online status

2. **Cache Invalidation**:

    - Time-based expiration (TTL)
    - Event-based invalidation when data changes
    - Selective invalidation to minimize cache misses

3. **Cache Keys**:

    - `messages:{conversationId}`: Conversation messages
    - `conversations:{userId}`: User's conversations
    - `session:{userId}`: User session data
    - `typing:{conversationId}`: Typing indicators
    - `parameters:{conversationId}`: Extracted travel parameters

4. **Cache TTL Strategy**:
    - Conversation messages: 1 day
    - User conversations: 30 days
    - Session data: 24 hours
    - Typing indicators: 30 seconds
    - Travel parameters: 1 day

## Error Handling

The application implements error handling at multiple levels:

### Frontend Error Handling

The frontend handles errors by:

1. Displaying error messages to the user using the ErrorMessage component
2. Logging errors to the console for debugging
3. Implementing retry mechanisms for failed API calls
4. Handling WebSocket connection errors

### Backend Error Handling

The backend handles errors by:

1. Using try-catch blocks to catch and log errors
2. Returning appropriate HTTP status codes for REST API errors
3. Logging errors with context information for debugging
4. Implementing graceful degradation for service failures
5. Using circuit breakers for database connections
6. Implementing retry mechanisms for transient errors

## Performance Considerations

The application is designed with performance in mind:

1. **Pagination**: The API supports pagination for large datasets
2. **Lazy Loading**: The frontend implements lazy loading for conversation history
3. **Optimistic Updates**: The UI is updated optimistically before receiving server confirmation
4. **Debouncing**: Input events are debounced to reduce unnecessary processing
5. **Caching**: Responses are cached where appropriate to reduce database load
6. **Database Indexing**: MongoDB collections are properly indexed for query performance
7. **Connection Pooling**: Database connections are pooled for better resource utilization
8. **Selective Data Loading**: Only necessary data is loaded to minimize network traffic

## Security Considerations

The application implements security measures:

1. **Input Validation**: All user inputs are validated before processing
2. **CORS**: Cross-Origin Resource Sharing is configured to restrict access
3. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
4. **Error Handling**: Error messages do not expose sensitive information
5. **Authentication**: User authentication is implemented (simplified for demo purposes)
6. **Database Security**: MongoDB and Redis connections are secured with authentication
7. **Data Encryption**: Sensitive data is encrypted in transit and at rest

## Testing Strategy

The application is designed to be testable:

1. **Unit Tests**: Individual components and functions are tested in isolation
2. **Integration Tests**: Interactions between components are tested
3. **End-to-End Tests**: The complete user flow is tested
4. **Mock Services**: External dependencies are mocked for testing
5. **Database Tests**: Database operations are tested with in-memory databases
6. **Cache Tests**: Caching behavior is tested with mock Redis instances

## Deployment Considerations

The application is designed for easy deployment:

1. **Containerization**: The application is containerized using Docker
2. **Environment Variables**: Configuration is managed through environment variables
3. **Health Checks**: Services implement health checks for monitoring
4. **Logging**: Comprehensive logging is implemented for debugging
5. **CI/CD**: Continuous Integration and Deployment pipelines are supported
6. **Database Migrations**: MongoDB schema changes are managed through migrations
7. **Cache Warming**: Redis cache is pre-warmed for common queries
8. **Horizontal Scaling**: Services can be scaled horizontally for increased load
