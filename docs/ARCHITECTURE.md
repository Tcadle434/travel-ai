# Travel AI App Architecture

## Overview

The Travel AI App is a conversational assistant designed to help users plan travel itineraries. It uses a microservices architecture with real-time messaging capabilities. The application consists of several components that work together to provide a seamless user experience.

## System Architecture

The system is built using a microservices architecture with the following components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Web Frontend  │◄───►│   API Gateway   │◄───►│  RabbitMQ       │
│   (Next.js)     │     │   (NestJS)      │     │  Message Broker │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 ▼                       ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │                 │     │                 │
                        │   MongoDB       │◄───►│  Redis Cache    │
                        │   Database      │     │                 │
                        │                 │     │                 │
                        └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │                 │
                                                │  Conversation   │
                                                │  Service        │
                                                │                 │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │                 │
                                                │   AI Service    │
                                                │                 │
                                                └─────────────────┘
```

### Components

1. **Web Frontend (Next.js)**

    - User interface for interacting with the travel assistant
    - Real-time communication via WebSockets
    - HTTP requests for data retrieval

2. **API Gateway (NestJS)**

    - Central entry point for all client requests
    - WebSocket server for real-time communication
    - REST API endpoints for data retrieval
    - Message broker integration
    - Database access coordination

3. **RabbitMQ Message Broker**

    - Handles asynchronous communication between services
    - Enables event-driven architecture
    - Provides reliable message delivery

4. **MongoDB Database**

    - Primary persistent data store
    - Stores conversation history and messages
    - Stores user data and preferences
    - Optimized with proper indexing for efficient queries

5. **Redis Cache**

    - Caching layer for frequently accessed data
    - Stores ephemeral data like session state
    - Improves performance by reducing database load
    - Implements various caching strategies (read-through, write-through)

6. **Conversation Service**

    - Processes user messages
    - Manages conversation state
    - Integrates with AI service for generating responses
    - Coordinates data storage and retrieval

7. **AI Service**
    - Generates responses to user queries
    - Extracts travel parameters from conversations
    - Creates travel itineraries based on user preferences

## Data Flow

### User Message Flow

1. User sends a message through the web interface
2. Message is sent to the API Gateway via WebSocket
3. API Gateway publishes a message to RabbitMQ
4. Conversation Service consumes the message
5. Conversation Service stores the message in MongoDB
6. Conversation Service invalidates relevant Redis cache entries
7. Conversation Service requests a response from the AI Service
8. AI Service generates a response
9. Conversation Service stores the response in MongoDB
10. Conversation Service updates Redis cache with new data
11. Conversation Service publishes the response to RabbitMQ
12. API Gateway consumes the response and sends it to the user via WebSocket

### Conversation History Retrieval

1. User selects a conversation in the web interface
2. Web interface makes an HTTP request to the API Gateway
3. API Gateway checks Redis cache for the conversation history
4. If cache hit, return cached data; if cache miss, query MongoDB
5. If querying MongoDB, update Redis cache with retrieved data
6. API Gateway returns the conversation history to the web interface
7. Web interface displays the conversation history

## Database Architecture

### MongoDB Database

MongoDB serves as the primary persistent data store with the following design:

#### Collections

1. **Conversations Collection**

    - Stores metadata about conversations
    - Indexed on `id`, `userId`, and `updatedAt` fields
    - Used for efficient conversation listing and retrieval

2. **Messages Collection**
    - Stores all messages in conversations
    - Indexed on `conversationId` and `timestamp` fields
    - Enables efficient message retrieval for specific conversations

#### Schema Design

```json
// Conversations Collection
{
	"id": "string",
	"userId": "string",
	"title": "string",
	"lastMessage": "string",
	"createdAt": "Date",
	"updatedAt": "Date"
}

// Messages Collection
{
	"id": "string",
	"conversationId": "string",
	"userId": "string",
	"role": "string",
	"content": "string",
	"timestamp": "Date"
}
```

#### Optimization Techniques

1. **Indexing Strategy**

    - Compound indexes for frequently queried fields
    - TTL indexes for automatic data expiration where applicable

2. **Query Optimization**

    - Projection to limit fields returned
    - Lean queries for better performance
    - Pagination for large result sets

3. **Connection Pooling**
    - Configured connection pool size based on workload
    - Connection monitoring and health checks

### Redis Cache

Redis is used as a caching layer with the following design:

#### Cache Types

1. **Read-Through Cache**

    - For conversation messages and user conversations
    - Reduces database load for frequently accessed data

2. **Session Cache**

    - For user session data and WebSocket connections
    - Enables stateless API Gateway instances

3. **Ephemeral Data**
    - For typing indicators and online status
    - Short-lived data that doesn't need persistence

#### Cache Keys and TTL

| Cache Key Pattern             | Data Type   | TTL        | Purpose                     |
| ----------------------------- | ----------- | ---------- | --------------------------- |
| `messages:{conversationId}`   | JSON Array  | 1 day      | Conversation messages       |
| `conversations:{userId}`      | JSON Array  | 30 days    | User's conversations        |
| `session:{userId}`            | JSON Object | 24 hours   | User session data           |
| `typing:{conversationId}`     | String      | 30 seconds | Typing indicators           |
| `parameters:{conversationId}` | JSON Object | 1 day      | Extracted travel parameters |

#### Cache Invalidation Strategies

1. **Time-based Expiration (TTL)**

    - Automatic expiration based on configured TTL
    - Different TTL for different types of data

2. **Event-based Invalidation**

    - Invalidate cache when underlying data changes
    - Targeted invalidation to minimize cache rebuilding

3. **Selective Invalidation**
    - Only invalidate affected cache entries
    - Maintain cache consistency while maximizing hit rate

## API Endpoints

### REST API

- `GET /api/conversations?userId={userId}` - Get all conversations for a user
- `GET /api/conversations/{conversationId}/messages` - Get all messages for a conversation
- `GET /api/conversations/test` - Test endpoint to verify controller functionality

### WebSocket Events

- `identify` - Identify the user to the server
- `create_conversation` - Create a new conversation
- `send_message` - Send a message in a conversation
- `message_received` - Receive a message from the server

## Frontend Components

The frontend is built using React with a component-based architecture:

- `ChatInterface` - Main component that orchestrates the chat experience
- `ChatSidebar` - Displays the list of conversations
- `MessageList` - Displays the messages in a conversation
- `MessageInput` - Allows the user to input messages
- `WelcomeScreen` - Displays a welcome message and suggested inputs
- `ErrorMessage` - Displays error messages
- `ChatHeader` - Displays the conversation title and controls

## Security Considerations

- User authentication is handled via a simple user ID for demo purposes
- In a production environment, proper authentication and authorization would be implemented
- WebSocket connections are secured with CORS restrictions
- API endpoints are protected with proper validation
- Database connections are secured with authentication
- Sensitive data is encrypted in transit and at rest

## Deployment Architecture

The application is containerized using Docker and can be deployed using Docker Compose:

```yaml
version: "3"
services:
    web:
        build: ./apps/web
        ports:
            - "3000:3000"
        environment:
            - API_URL=http://api-gateway:4000
            - WEBSOCKET_URL=http://api-gateway:4000

    api-gateway:
        build: ./apps/api-gateway
        ports:
            - "4000:4000"
        environment:
            - MONGODB_URI=mongodb://mongodb:27017
            - MONGODB_DB_NAME=travel_ai
            - REDIS_HOST=redis
            - REDIS_PORT=6379
            - RABBITMQ_URL=amqp://rabbitmq:5672
            - FRONTEND_URL=http://localhost:3000
        depends_on:
            - mongodb
            - redis
            - rabbitmq

    conversation-service:
        build: ./packages/conversation-service
        environment:
            - MONGODB_URI=mongodb://mongodb:27017
            - MONGODB_DB_NAME=travel_ai
            - REDIS_HOST=redis
            - REDIS_PORT=6379
            - RABBITMQ_URL=amqp://rabbitmq:5672
        depends_on:
            - mongodb
            - redis
            - rabbitmq

    mongodb:
        image: mongo:latest
        ports:
            - "27017:27017"
        volumes:
            - mongodb_data:/data/db
        environment:
            - MONGO_INITDB_ROOT_USERNAME=root
            - MONGO_INITDB_ROOT_PASSWORD=example

    redis:
        image: redis:latest
        ports:
            - "6379:6379"
        volumes:
            - redis_data:/data
        command: redis-server --requirepass example

    rabbitmq:
        image: rabbitmq:management
        ports:
            - "5672:5672"
            - "15672:15672"
        volumes:
            - rabbitmq_data:/var/lib/rabbitmq
        environment:
            - RABBITMQ_DEFAULT_USER=user
            - RABBITMQ_DEFAULT_PASS=password

volumes:
    mongodb_data:
    redis_data:
    rabbitmq_data:
```

## Development Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development environment with `docker-compose up`
4. Access the web interface at `http://localhost:3000`

## Future Improvements

1. Implement proper user authentication
2. Add support for multimedia messages (images, videos)
3. Implement a more sophisticated caching strategy
4. Add support for multiple languages
5. Implement analytics to track user interactions
6. Add support for voice input and output
7. Implement database sharding for horizontal scaling
8. Add real-time collaboration features
