@SubscribeMessage('send_message')
async handleMessage(
  @MessageBody() data: { userId: string; conversationId: string; message: string; isTravelRequest?: boolean },
  @ConnectedSocket() client: Socket,
) {
  try {
    console.log('Received message:', data);
    const { userId, conversationId, message, isTravelRequest } = data;

    // Validate the message
    if (!message || !userId || !conversationId) {
      return { success: false, error: 'Invalid message data' };
    }

    // Store the user message
    const userMessage = await this.messageService.createMessage({
      content: message,
      isUser: true,
      conversationId,
      userId,
    });

    // Emit the user message back to the client
    client.emit('message', {
      id: userMessage.id,
      content: userMessage.content,
      isUser: userMessage.isUser,
      timestamp: userMessage.createdAt,
    });

    // Process the message with AI
    let aiResponse: string;
    
    if (isTravelRequest) {
      console.log('Travel request detected, generating itineraries');
      aiResponse = await this.enhanceMessageForMultipleItineraries(message);
    } else {
      aiResponse = await this.openaiService.generateResponse(message);
    }

    // Check if the response is too large and needs to be chunked
    if (aiResponse.length > 8000) {
      await this.sendChunkedMessage(aiResponse, conversationId, userId, client);
    } else {
      // Store the AI response
      const aiMessage = await this.messageService.createMessage({
        content: aiResponse,
        isUser: false,
        conversationId,
        userId,
      });

      // Emit the AI response back to the client
      client.emit('message', {
        id: aiMessage.id,
        content: aiMessage.content,
        isUser: aiMessage.isUser,
        timestamp: aiMessage.createdAt,
      });

      // Check if the response contains itineraries
      if (this.containsItineraries(aiResponse)) {
        client.emit('itineraries_complete', { message: 'Itineraries generated successfully' });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling message:', error);
    return { success: false, error: error.message };
  }
}

private enhanceMessageForMultipleItineraries(userMessage: string): Promise<string> {
  const enhancedPrompt = `
You are a travel planning assistant. Based on the user's request: "${userMessage}", 
please generate THREE distinct travel itineraries.

IMPORTANT FORMATTING INSTRUCTIONS:
1. Start each itinerary with a level 2 markdown heading (##) containing the destination name.
2. Each itinerary MUST be clearly separated and labeled as "ITINERARY 1", "ITINERARY 2", and "ITINERARY 3".
3. For each itinerary, include the following sections with level 3 markdown headings (###):
   - Overview
   - Daily Schedule (day-by-day breakdown)
   - Accommodations
   - Transportation
   - Estimated Budget
   - Highlights

Your response MUST follow this exact format to ensure proper parsing:

## ITINERARY 1: [Destination Name]
### Overview
[Brief description of the destination and why it's suitable]

### Daily Schedule
[Day-by-day breakdown of activities]

### Accommodations
[Suggested places to stay with approximate costs]

### Transportation
[Transportation options and costs]

### Estimated Budget
[Detailed budget breakdown]

### Highlights
[Key attractions and experiences]

## ITINERARY 2: [Different Destination Name]
[Follow same format as above]

## ITINERARY 3: [Another Different Destination Name]
[Follow same format as above]

Be creative and provide genuinely different options that match the user's preferences. Make sure each itinerary is comprehensive and detailed.
`;

  return this.openaiService.generateResponse(enhancedPrompt);
}

private containsItineraries(message: string): boolean {
  // Check for itinerary markers in the message
  const itineraryMarkers = [
    /##\s*ITINERARY\s*[1-3]/i,
    /##\s*[A-Za-z\s]+\s*Itinerary/i,
    /Itinerary\s*[1-3]:/i,
    /Day\s*[1-7]:/i
  ];
  
  return itineraryMarkers.some(marker => marker.test(message));
}

/**
 * Sends a large message in chunks to prevent truncation
 */
private async sendChunkedMessage(
  message: string,
  conversationId: string,
  userId: string,
  client: Socket,
) {
  try {
    console.log(`Message is large (${message.length} chars), sending in chunks`);
    
    // Define chunk size and create chunks
    const chunks = this.createMessageChunks(message);
    console.log(`Split message into ${chunks.length} chunks`);
    
    // Send each chunk with metadata
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;
      
      // Store the chunk in the database
      const aiMessage = await this.messageService.createMessage({
        content: chunk,
        isUser: false,
        conversationId,
        userId,
        metadata: {
          isChunk: true,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
      });
      
      // Emit the chunk to the client
      client.emit('message', {
        id: aiMessage.id,
        content: chunk,
        isUser: aiMessage.isUser,
        timestamp: aiMessage.createdAt,
        metadata: {
          isChunk: true,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
      });
      
      // Small delay between chunks to ensure order
      if (!isLastChunk) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Check if the response contains itineraries
    if (this.containsItineraries(message)) {
      // Send a notification that itineraries are complete
      client.emit('itineraries_complete', { message: 'Itineraries generated successfully' });
    }
    
    console.log('Finished sending chunked message');
  } catch (error) {
    console.error('Error sending chunked message:', error);
    throw error;
  }
}

/**
 * Creates logical chunks from a large message
 */
private createMessageChunks(message: string): string[] {
  const MAX_CHUNK_SIZE = 4000;
  const chunks: string[] = [];
  
  // If message is small enough, return as single chunk
  if (message.length <= MAX_CHUNK_SIZE) {
    return [message];
  }
  
  let remainingMessage = message;
  
  while (remainingMessage.length > 0) {
    let chunkSize = Math.min(remainingMessage.length, MAX_CHUNK_SIZE);
    
    // Try to find a good breaking point (paragraph, sentence, or word boundary)
    if (chunkSize < remainingMessage.length) {
      // Look for paragraph break
      const paragraphBreak = remainingMessage.lastIndexOf('\n\n', chunkSize);
      if (paragraphBreak > chunkSize * 0.7) {
        chunkSize = paragraphBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = remainingMessage.lastIndexOf('. ', chunkSize);
        if (sentenceBreak > chunkSize * 0.7) {
          chunkSize = sentenceBreak + 2;
        } else {
          // Look for word break
          const wordBreak = remainingMessage.lastIndexOf(' ', chunkSize);
          if (wordBreak > chunkSize * 0.7) {
            chunkSize = wordBreak + 1;
          }
        }
      }
    }
    
    // Extract the chunk and add to chunks array
    const chunk = remainingMessage.substring(0, chunkSize);
    chunks.push(chunk);
    
    // Update remaining message
    remainingMessage = remainingMessage.substring(chunkSize);
  }
  
  return chunks;
}

/**
 * Handle create conversation request
 */
@SubscribeMessage('create_conversation')
async handleCreateConversation(
  @MessageBody() data: { userId: string; title?: string },
  @ConnectedSocket() client: Socket,
) {
  try {
    console.log('Create conversation request:', data);
    const { userId, title } = data;

    // Validate the request
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }

    // Create a new conversation
    const conversationTitle = title || 'New Conversation';
    const conversationId = 'conv-' + Date.now();

    // Here you would typically save the conversation to your database
    // For now, we'll just return the new conversation ID
    
    console.log(`Created new conversation: ${conversationId} for user ${userId}`);

    return { 
      success: true, 
      conversationId, 
      title: conversationTitle 
    };
  } catch (error) {
    console.error('Error creating conversation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle join conversation request
 */
@SubscribeMessage('join_conversation')
async handleJoinConversation(
  @MessageBody() data: { conversationId: string },
  @ConnectedSocket() client: Socket,
) {
  try {
    console.log('Join conversation request:', data);
    const { conversationId } = data;

    // Validate the request
    if (!conversationId) {
      return { success: false, error: 'Conversation ID is required' };
    }

    // Join the conversation room
    client.join(conversationId);
    
    console.log(`Client ${client.id} joined conversation: ${conversationId}`);

    return { success: true };
  } catch (error) {
    console.error('Error joining conversation:', error);
    return { success: false, error: error.message };
  }
} 