// Common interfaces for the chat application

export interface Message {
	id: string;
	content: string;
	isUser: boolean;
	timestamp: Date;
}

export interface ApiMessage {
	id: string;
	conversationId: string;
	userId: string;
	role: string;
	content: string;
	timestamp: string | Date;
}

export interface ConversationHistory {
	id: string;
	title: string;
	lastMessage: string;
	timestamp: Date;
	updatedAt?: Date;
	createdAt?: Date;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

// Itinerary interfaces
export interface ItineraryActivity {
	time?: string;
	activity: string;
	description: string;
	location?: string;
}

export interface ItineraryDay {
	day: number;
	title: string;
	activities: ItineraryActivity[];
}

export interface ItineraryOption {
	title: string;
	highlights: string[];
	description: string;
	days: ItineraryDay[];
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

export interface ItineraryData {
	id: string;
	options: {
		destination: string;
		duration: string;
		travelers: string;
		options: ItineraryOption[];
	};
	timestamp: Date;
}

export enum AppView {
	CHAT = "chat",
	ITINERARY = "itinerary",
}
