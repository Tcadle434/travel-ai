import { Itinerary, ItineraryHighlight } from "../types/itinerary";

/**
 * Parses a markdown string containing multiple itineraries
 * @param content The markdown content to parse
 * @returns An array of Itinerary objects
 */
export function parseItineraries(content: string): Itinerary[] {
	if (!content) return [];

	console.log("Parsing itineraries from content:", content.substring(0, 100) + "...");

	// Split the content into separate itinerary blocks based on markdown headings
	const itineraryBlocks = splitIntoItineraryBlocks(content);
	console.log(`Found ${itineraryBlocks.length} itinerary blocks`);

	// Parse each block into an Itinerary object
	return itineraryBlocks
		.map((block, index) => {
			return parseItineraryBlock(block, index + 1);
		})
		.filter(Boolean);
}

/**
 * Splits markdown content into separate itinerary blocks
 */
function splitIntoItineraryBlocks(content: string): string[] {
	// Look for level 2 headings that indicate itineraries
	const itineraryPattern = /##\s*(ITINERARY\s*\d+:|[^#\n]+)/gi;
	const matches = [...content.matchAll(itineraryPattern)];

	if (matches.length === 0) {
		// Fallback: try to split by "Itinerary X:" patterns
		const fallbackPattern = /(?:^|\n)(?:Itinerary\s*\d+:|Day\s*1:)/gi;
		const fallbackMatches = [...content.matchAll(fallbackPattern)];

		if (fallbackMatches.length > 0) {
			return splitByMatches(content, fallbackMatches);
		}

		// If still no matches, return the whole content as one block
		return [content];
	}

	return splitByMatches(content, matches);
}

/**
 * Helper function to split content by regex matches
 */
function splitByMatches(content: string, matches: RegExpMatchArray[]): string[] {
	const blocks: string[] = [];

	matches.forEach((match, index) => {
		const startPos = match.index;
		const endPos = index < matches.length - 1 ? matches[index + 1].index : content.length;

		if (startPos !== undefined && endPos !== undefined) {
			blocks.push(content.substring(startPos, endPos));
		}
	});

	return blocks;
}

/**
 * Parses a single itinerary block into an Itinerary object
 */
function parseItineraryBlock(block: string, index: number): Itinerary {
	// Extract the title/destination
	const titleMatch = block.match(/##\s*(ITINERARY\s*\d+:?\s*)?([^#\n]+)/i);
	const destination = titleMatch ? titleMatch[2].trim() : `Itinerary ${index}`;

	// Extract sections using markdown headings
	const sections: Record<string, string> = {};
	const sectionPattern = /###\s*([^#\n]+)([\s\S]*?)(?=###|$)/g;
	let sectionMatch;

	while ((sectionMatch = sectionPattern.exec(block)) !== null) {
		const sectionName = sectionMatch[1].trim().toLowerCase();
		const sectionContent = sectionMatch[2].trim();
		sections[sectionName] = sectionContent;
	}

	// Extract highlights
	let highlights: ItineraryHighlight[] = [];

	// Try to get highlights from the dedicated section first
	if (sections["highlights"]) {
		highlights = extractHighlightsFromSection(sections["highlights"]);
	}
	// If no highlights section or it's empty, extract from other sections
	if (highlights.length === 0) {
		highlights = extractHighlightsFromContent(block);
	}

	// Extract budget information
	const budget = extractBudget(sections["estimated budget"] || sections["budget"] || block);

	// Extract daily schedule
	const dailySchedule = extractDailySchedule(
		sections["daily schedule"] || sections["schedule"] || block
	);

	// Extract accommodations
	const accommodations = extractAccommodations(
		sections["accommodations"] || sections["accommodation"] || block
	);

	// Extract transportation
	const transportation = extractTransportation(sections["transportation"] || block);

	// Create the itinerary object
	return {
		id: `itinerary-${index}`,
		destination,
		description: sections["overview"] || "",
		highlights,
		budget,
		dailySchedule,
		accommodations,
		transportation,
		fullContent: block,
	};
}

/**
 * Extracts highlights from a dedicated highlights section
 */
function extractHighlightsFromSection(content: string): ItineraryHighlight[] {
	const highlights: ItineraryHighlight[] = [];
	const lines = content.split("\n");

	lines.forEach((line) => {
		// Look for bullet points or numbered items
		const match = line.match(/^[\s-]*(?:\d+\.|\*|\-)\s*(.+)$/);
		if (match) {
			highlights.push({
				id: `highlight-${highlights.length + 1}`,
				title: match[1].trim(),
				description: "",
			});
		}
	});

	return highlights;
}

/**
 * Extracts highlights from the general content
 */
function extractHighlightsFromContent(content: string): ItineraryHighlight[] {
	const highlights: ItineraryHighlight[] = [];

	// Look for key attractions or experiences
	const attractionPatterns = [
		/must-see/i,
		/highlight/i,
		/attraction/i,
		/experience/i,
		/don't miss/i,
		/famous/i,
		/popular/i,
	];

	const lines = content.split("\n");

	lines.forEach((line) => {
		// Check if the line contains any of the attraction patterns
		if (attractionPatterns.some((pattern) => pattern.test(line))) {
			// Extract the highlight from the line
			const match = line.match(/^[\s-]*(?:\d+\.|\*|\-)\s*(.+)$/);
			if (match) {
				highlights.push({
					id: `highlight-${highlights.length + 1}`,
					title: match[1].trim(),
					description: "",
				});
			} else {
				// If not a bullet point, just use the whole line
				highlights.push({
					id: `highlight-${highlights.length + 1}`,
					title: line.trim(),
					description: "",
				});
			}
		}
	});

	// Limit to 5 highlights
	return highlights.slice(0, 5);
}

/**
 * Extracts budget information from the content
 */
function extractBudget(content: string): string {
	// Look for budget information
	const budgetMatch = content.match(/(?:budget|cost|price|expense)(?:[^\n.]*?):?\s*([^\n.]+)/i);
	return budgetMatch ? budgetMatch[1].trim() : "";
}

/**
 * Extracts daily schedule information
 */
function extractDailySchedule(content: string): string {
	// If there's a dedicated section, return it
	if (content && content.length > 20) {
		return content;
	}

	// Otherwise, try to find day-by-day information in the full content
	const dayPattern = /day\s*\d+[:\-]/i;
	if (dayPattern.test(content)) {
		return content;
	}

	return "";
}

/**
 * Extracts accommodation information
 */
function extractAccommodations(content: string): string {
	if (content && content.length > 20) {
		return content;
	}

	// Try to find accommodation information
	const accommodationPattern =
		/(?:stay|hotel|hostel|airbnb|accommodation)(?:[^\n.]*?):?\s*([^\n.]+)/i;
	const match = content.match(accommodationPattern);
	return match ? match[1].trim() : "";
}

/**
 * Extracts transportation information
 */
function extractTransportation(content: string): string {
	if (content && content.length > 20) {
		return content;
	}

	// Try to find transportation information
	const transportPattern =
		/(?:transport|travel|getting around|flight|car|bus|train)(?:[^\n.]*?):?\s*([^\n.]+)/i;
	const match = content.match(transportPattern);
	return match ? match[1].trim() : "";
}
