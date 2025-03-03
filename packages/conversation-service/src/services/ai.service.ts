// src/services/ai.service.ts
import OpenAI from "openai";

export interface ItineraryOption {
	title: string;
	highlights: string[];
	description: string;
	days: Array<{
		day: number;
		title: string;
		activities: Array<{
			time?: string;
			activity: string;
			description: string;
			location?: string;
		}>;
	}>;
	estimatedCost?: {
		amount: number;
		currency: string;
		breakdown?: Record<string, number>;
	};
	accommodations?: Array<{
		name: string;
		description: string;
		priceRange?: string;
	}>;
	transportation?: Array<{
		type: string;
		description: string;
	}>;
}

export interface ItineraryOptions {
	destination: string;
	duration: string;
	travelers: string;
	options: ItineraryOption[];
}

export class AIService {
	private openai: OpenAI;
	private systemPrompt: string;
	private itineraryPrompt: string;

	constructor() {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY environment variable is not set");
		}

		this.openai = new OpenAI({
			apiKey: apiKey,
		});

		this.systemPrompt = this.getTravelAssistantPrompt();
		this.itineraryPrompt = this.getItineraryPrompt();
	}

	/**
	 * Generate a response based on the conversation history
	 */
	async generateResponse(messages: any[]): Promise<string> {
		try {
			// Format messages for OpenAI (system prompt + conversation history)
			const formattedMessages = this.formatMessagesForOpenAI(messages);

			const response = await this.openai.chat.completions.create({
				model: "gpt-4", // Or 'gpt-3.5-turbo' for cost savings
				messages: formattedMessages,
				temperature: 0.7,
				max_tokens: 2000,
			});

			return (
				response.choices[0]?.message?.content ||
				"I apologize, but I seem to be having trouble. Could you please try again?"
			);
		} catch (error) {
			console.error("Error generating AI response:", error);
			return "Sorry, I encountered an issue processing your request. Could you please try again later?";
		}
	}

	/**
	 * Format messages for the OpenAI API
	 */
	private formatMessagesForOpenAI(messages: any[]): any[] {
		const formattedMessages = [{ role: "system", content: this.systemPrompt }];

		// Add conversation history
		for (const message of messages) {
			formattedMessages.push({
				role: message.role === "user" ? "user" : "assistant",
				content: message.content,
			});
		}

		return formattedMessages;
	}

	/**
	 * Get the system prompt for the travel assistant
	 */
	private getTravelAssistantPrompt(): string {
		return `
You are a helpful and friendly travel assistant. Your goal is to help users plan their perfect trip by understanding their preferences and suggesting great travel ideas.

Guidelines:
1. Focus on understanding the user's travel preferences: destinations, dates, budget, interests, accommodation preferences, etc.
2. Ask relevant follow-up questions to gather information you need to provide personalized recommendations.
3. Be conversational and friendly, maintaining a helpful tone throughout the conversation.
4. Provide specific, tailored travel recommendations based on the information gathered.
5. If the user's request is vague, ask clarifying questions before making assumptions.
6. Offer practical travel tips and insider advice when relevant.
7. Be respectful of budget constraints and offer options at different price points when appropriate.
8. Suggest activities that match the user's stated interests.
9. When recommending destinations, consider the time of year and seasonal appropriateness.
10. When you have enough information to provide a complete travel itinerary, use one of these signal phrases:
   - "I can now provide some itinerary options for you."
   - "I'll prepare some itinerary options for you."
   - "Here's a rough itinerary for your trip."
   - "Here's what I recommend for your trip."
   - "I've prepared three itinerary options for you based on our conversation."

IMPORTANT: When the user confirms they like your suggested approach or answers your questions with sufficient details about their trip (including at minimum a destination), respond with one of the signal phrases above. This will trigger the itinerary generation system.

Remember to keep responses concise yet informative. Your goal is to help users plan a trip they'll love!
`;
	}

	/**
	 * Extract travel parameters from conversation
	 */
	async extractTravelParameters(messages: any[]): Promise<any> {
		try {
			// Create a special prompt for parameter extraction
			const extractionPrompt = {
				role: "system" as const,
				content: this.getParameterExtractionPrompt(),
			};

			// Format conversation history
			const conversationHistory = messages.map((msg) => ({
				role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
				content: msg.content,
			}));

			// Add a final instruction to extract parameters
			const extractionInstruction = {
				role: "user" as const,
				content:
					"Based on the conversation above, extract all travel parameters in valid JSON format.",
			};

			const response = await this.openai.chat.completions.create({
				model: "gpt-4",
				messages: [extractionPrompt, ...conversationHistory, extractionInstruction],
				temperature: 0.1, // Lower temperature for more deterministic output
				max_tokens: 2000,
			});

			const extractedContent = response.choices[0]?.message?.content || "{}";

			// Parse the JSON response
			try {
				return JSON.parse(extractedContent);
			} catch (parseError) {
				console.error("Error parsing extracted parameters:", parseError);
				return {};
			}
		} catch (error) {
			console.error("Error extracting travel parameters:", error);
			return {};
		}
	}

	/**
	 * Get the parameter extraction prompt
	 */
	private getParameterExtractionPrompt(): string {
		return `
  You are a travel parameter extraction system. Your task is to analyze a conversation between a user and a travel assistant, and extract structured travel parameters from it.
  
  Extract only the parameters that have been explicitly mentioned or that can be directly inferred from the conversation. Don't make assumptions beyond what's in the conversation.
  
  Please extract the following parameters if available:
  - destination: The place(s) the user wants to visit (string or array of strings)
  - startDate: When the user wants to start their trip (ISO date string if specific, or descriptive string like "mid-July")
  - endDate: When the user wants to end their trip (ISO date string if specific, or descriptive string)
  - budget: { amount: number, currency: string } - The user's budget
  - interests: Array of activities or themes the user is interested in
  - numberOfTravelers: How many people are traveling
  - preferences: Object containing preferences like accommodationType, transportationPreference, activityLevel
  - constraints: Array of any limitations or constraints
  - flexible: Boolean indicating if dates/plans are flexible
  
  Return your output as a valid JSON object containing only the parameters you were able to extract. If a parameter wasn't mentioned, don't include it in the output.
  `;
	}

	/**
	 * Check if we have enough information to generate itineraries
	 */
	async shouldGenerateItineraries(messages: any[]): Promise<boolean> {
		try {
			const parameters = await this.extractTravelParameters(messages);
			const requiredParameters = ["destination"];

			// Check if we have the minimum required parameters
			const hasRequiredParameters = requiredParameters.every(
				(param) =>
					parameters[param] !== undefined &&
					parameters[param] !== null &&
					parameters[param] !== ""
			);

			// Get the last few messages to analyze context
			const lastUserMessages = [...messages]
				.reverse()
				.filter((msg) => msg.role === "user")
				.slice(0, 3)
				.map((msg) => msg.content.toLowerCase());

			const lastAssistantMessages = [...messages]
				.reverse()
				.filter((msg) => msg.role === "assistant")
				.slice(0, 3)
				.map((msg) => msg.content.toLowerCase());

			// Detect if there's enough context to generate itineraries
			const hasMultipleTurns = messages.filter((msg) => msg.role === "user").length >= 2;

			// Check if the user's most recent message is an explicit request or affirmative
			const userWantsItinerary =
				lastUserMessages.length > 0 &&
				(/\b(please do|show me|give me|generate|create|i want|itinerary|itineraries|options|suggestions|recommend|ideas)\b/i.test(
					lastUserMessages[0]
				) ||
					lastUserMessages[0].length < 20 || // Short replies like "ok" or "you pick for me"
					/\b(yes|yeah|sounds good|sure|ok|okay|good|great|perfect|fine|proceed|continue|go ahead)\b/i.test(
						lastUserMessages[0]
					));

			// Check if the assistant has gathered enough information
			const assistantHasCollectedInfo = lastAssistantMessages.some(
				(msg) =>
					msg.includes("based on your preferences") ||
					msg.includes("here are some options") ||
					msg.includes("i've prepared") ||
					msg.includes("let me create") ||
					msg.includes("i can suggest") ||
					msg.includes("would you like me to") ||
					msg.includes("trip to") ||
					msg.includes("stay in") ||
					msg.includes("visit") ||
					msg.includes("travel to") ||
					msg.includes("include") ||
					msg.includes("budget") ||
					msg.includes("suggested itinerary") ||
					msg.includes("i could suggest") ||
					msg.includes("i'll create an itinerary") ||
					msg.includes("let me plan") ||
					msg.includes("provide some itinerary options") ||
					msg.includes("tailored recommendations") ||
					msg.includes("can start preparing")
			);

			// Enhanced signal detection
			const containsSignalPhrase = lastAssistantMessages.some(
				(msg) =>
					msg.includes("i can now provide") ||
					msg.includes("i can provide") ||
					msg.includes("i'll prepare") ||
					msg.includes("here's a rough") ||
					msg.includes("here's what i recommend") ||
					msg.includes("here's an itinerary") ||
					msg.includes("here are a few options")
			);

			// Check for final confirmation signals from the user after assistant has collected info
			const userRequestedFinalOutput =
				userWantsItinerary && assistantHasCollectedInfo && hasMultipleTurns;

			// Generate itineraries if:
			// 1. We have destination and the AI has suggested it can provide options, OR
			// 2. We have destination, the user explicitly wants options, and the AI has gathered info
			return hasRequiredParameters && (containsSignalPhrase || userRequestedFinalOutput);
		} catch (error) {
			console.error("Error checking if should generate itineraries:", error);
			return false;
		}
	}

	/**
	 * Generate multiple itinerary options
	 */
	async generateItineraryOptions(messages: any[]): Promise<ItineraryOptions> {
		try {
			// Extract travel parameters first to use in the prompt
			const parameters = await this.extractTravelParameters(messages);

			// Create a special prompt for itinerary generation
			const itinerarySystemPrompt = {
				role: "system" as const,
				content: this.itineraryPrompt,
			};

			// Format conversation history
			const conversationHistory = messages.map((msg) => ({
				role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
				content: msg.content,
			}));

			// Add a final instruction to generate itineraries
			const generationInstruction = {
				role: "user" as const,
				content:
					"Based on our conversation, please generate three distinct travel itinerary options in the requested JSON format. Make each option unique with different focuses/themes while still meeting my preferences.",
			};

			// Fix: Remove response_format parameter that causes errors
			const response = await this.openai.chat.completions.create({
				model: "gpt-4",
				messages: [
					itinerarySystemPrompt,
					...conversationHistory,
					{
						role: "user" as const,
						content:
							"Ensure you respond with ONLY valid JSON. Do not include markdown formatting, explanations, or code blocks. Each itinerary option must have unique and different activities for each day, not just the same activities repeated.",
					},
					generationInstruction,
				],
				temperature: 0.8, // Higher temperature for more diverse options
				max_tokens: 4000,
			});

			const generatedContent = response.choices[0]?.message?.content || "{}";

			// Parse the JSON response
			try {
				const parsedResponse = JSON.parse(generatedContent);
				return parsedResponse;
			} catch (parseError) {
				console.error("Error parsing itinerary options:", parseError);
				throw new Error("Failed to parse itinerary options");
			}
		} catch (error) {
			console.error("Error generating itinerary options:", error);
			throw new Error("Failed to generate itinerary options");
		}
	}

	/**
	 * Get the itinerary generation prompt
	 */
	private getItineraryPrompt(): string {
		return `
You are a travel itinerary generator. Your task is to create EXACTLY THREE distinct travel itinerary options based on the user's preferences discussed in the conversation.

Each itinerary MUST:
1. Have a unique focus or theme (e.g., cultural immersion, adventure, relaxation, budget-friendly, luxury)
2. Include daily activities appropriate for the destination with specific time-of-day suggestions
3. Suggest accommodations that match the style/budget preferences
4. Include recommendations for transportation
5. Provide estimated costs if budget information is available

CRITICAL INSTRUCTIONS:
- You MUST create EXACTLY THREE different itinerary options
- Make each option genuinely different in focus, activities, or accommodation types
- Each option should be comprehensive and detailed
- Be specific about locations, activities, and costs
- Use realistic estimates for costs and timeframes
- Include at least 3-5 highlights for each option

Return your response as a valid JSON object with this exact structure:
{
  "destination": "Name of destination",
  "duration": "Description of trip duration", 
  "travelers": "Description of travelers",
  "options": [
    {
      "title": "Option 1: [Theme/Focus]",
      "highlights": ["key highlight 1", "key highlight 2", "key highlight 3"],
      "description": "Brief overview of this itinerary option",
      "days": [
        {
          "day": 1,
          "title": "Day 1: [Brief title]",
          "activities": [
            {
              "time": "Morning",
              "activity": "Name of activity",
              "description": "Description of activity",
              "location": "Location name if applicable"
            },
            // More activities...
          ]
        },
        // More days...
      ],
      "estimatedCost": {
        "amount": 1500,
        "currency": "USD",
        "breakdown": {
          "accommodation": 500,
          "food": 300,
          "activities": 400,
          "transportation": 300
        }
      },
      "accommodations": [
        {
          "name": "Accommodation name",
          "description": "Brief description",
          "priceRange": "Price range if applicable"
        }
      ],
      "transportation": [
        {
          "type": "Type of transportation",
          "description": "Description of transportation option"
        }
      ]
    },
    // MUST include two more options with the same structure
  ]
}

IMPORTANT: You MUST generate EXACTLY THREE complete itinerary options. Do not skip any fields in the structure.
`;
	}
}
