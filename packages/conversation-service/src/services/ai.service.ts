// src/services/ai.service.ts
import OpenAI from "openai";

export class AIService {
	private openai: OpenAI;
	private systemPrompt: string;

	constructor() {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY environment variable is not set");
		}

		this.openai = new OpenAI({
			apiKey: apiKey,
		});

		this.systemPrompt = this.getTravelAssistantPrompt();
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
				max_tokens: 500,
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
				max_tokens: 1000,
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
}
