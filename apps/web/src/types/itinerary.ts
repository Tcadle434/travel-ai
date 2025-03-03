/**
 * Represents a highlight or key attraction in an itinerary
 */
export interface ItineraryHighlight {
	id: string;
	title: string;
	description: string;
	imageUrl?: string;
}

/**
 * Represents a complete travel itinerary
 */
export interface Itinerary {
	id: string;
	destination: string;
	description: string;
	highlights: ItineraryHighlight[];
	budget: string;
	dailySchedule: string;
	accommodations: string;
	transportation: string;
	fullContent: string;
	imageUrl?: string;
}
