import { Itinerary, ItineraryHighlight } from "../components/types";

/**
 * Extracts itinerary information from AI-generated content
 * @param content The AI-generated content containing itinerary information
 * @returns An array of parsed itineraries
 */
export function parseItinerariesFromContent(content: string): Itinerary[] {
	// Check if the content contains itineraries
	if (!content.includes("Itinerary") && !content.includes("ITINERARY")) {
		return [];
	}

	// Try to identify multiple itineraries in the content
	const itineraryBlocks = splitIntoItineraryBlocks(content);

	if (itineraryBlocks.length === 0) {
		// If we couldn't split into blocks, treat the whole content as one itinerary
		return [createSingleItinerary(content)];
	}

	// Parse each itinerary block
	return itineraryBlocks.map((block, index) => {
		return {
			id: `itinerary-${Date.now()}-${index}`,
			title: extractTitle(block) || `Itinerary Option ${index + 1}`,
			description: extractDescription(block) || "A personalized travel itinerary",
			days: extractDays(block),
			highlights: extractHighlights(block),
			fullContent: block,
			createdAt: new Date(),
		};
	});
}

/**
 * Splits content into separate itinerary blocks
 */
function splitIntoItineraryBlocks(content: string): string[] {
	// Try to split by markdown headings for itineraries
	const headingPattern = /(?:^|\n)(?:# Itinerary \d|# ITINERARY \d|Itinerary \d:)/g;
	const matches = Array.from(content.matchAll(headingPattern));

	if (matches && matches.length > 1) {
		const blocks: string[] = [];

		// Find each itinerary section
		for (let i = 0; i < matches.length; i++) {
			const currentMatch = matches[i];
			const currentIndex = currentMatch.index || 0;

			// If this is the last match, go to the end of the content
			const nextIndex = i < matches.length - 1 ? matches[i + 1].index : content.length;

			// Extract the block
			const block = content.substring(currentIndex, nextIndex);
			blocks.push(block.trim());
		}

		return blocks;
	}

	// Try to split by "Itinerary 1", "Itinerary 2", etc.
	const itineraryNumberPattern = /\b(Itinerary\s+[1-3]|ITINERARY\s+[1-3]|Option\s+[1-3])\b/g;
	const plainMatches = Array.from(content.matchAll(itineraryNumberPattern));

	if (plainMatches && plainMatches.length > 1) {
		const blocks: string[] = [];

		// Find each itinerary section
		for (let i = 0; i < plainMatches.length; i++) {
			const currentMatch = plainMatches[i];
			const currentIndex = currentMatch.index || 0;

			// If this is the last match, go to the end of the content
			const nextIndex =
				i < plainMatches.length - 1 ? plainMatches[i + 1].index : content.length;

			// Extract the block
			const block = content.substring(currentIndex, nextIndex);
			blocks.push(block.trim());
		}

		return blocks;
	}

	// Try alternative splitting methods
	// Split by "Option 1", "Option 2", etc.
	const optionPattern = /\b(Option\s+[1-3]|OPTION\s+[1-3])\b/g;
	const optionMatches = Array.from(content.matchAll(optionPattern));

	if (optionMatches && optionMatches.length > 1) {
		const blocks: string[] = [];

		// Find each itinerary section
		for (let i = 0; i < optionMatches.length; i++) {
			const currentMatch = optionMatches[i];
			const currentIndex = currentMatch.index || 0;

			// If this is the last match, go to the end of the content
			const nextIndex =
				i < optionMatches.length - 1 ? optionMatches[i + 1].index : content.length;

			// Extract the block
			const block = content.substring(currentIndex, nextIndex);
			blocks.push(block.trim());
		}

		return blocks;
	}

	// If we can't identify multiple itineraries, return an empty array
	// The caller will handle this by treating the whole content as one itinerary
	return [];
}

/**
 * Creates a single itinerary from the entire content
 */
function createSingleItinerary(content: string): Itinerary {
	return {
		id: `itinerary-${Date.now()}`,
		title: extractTitle(content) || "Travel Itinerary",
		description: extractDescription(content) || "A personalized travel itinerary",
		days: extractDays(content),
		highlights: extractHighlights(content),
		fullContent: content,
		createdAt: new Date(),
	};
}

/**
 * Extracts the title from the itinerary content
 */
function extractTitle(content: string): string | null {
	// Look for markdown heading title patterns
	const markdownTitlePatterns = [/(?:^|\n)# Itinerary \d+:?\s*([^\n]+)/i, /(?:^|\n)# ([^\n]+)/i];

	for (const pattern of markdownTitlePatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			return match[1].trim();
		}
	}

	// Look for other title patterns
	const titlePatterns = [
		/(?:^|\n)(?:Itinerary|ITINERARY|Travel Plan|TRAVEL PLAN)(?:\s*\d*\s*)?(?:\:|for)?(?:\s*)([^\n\.]+)/i,
		/(?:^|\n)(?:Option|OPTION)(?:\s*\d*\s*)?(?:\:|-)(?:\s*)([^\n\.]+)/i,
		/(?:^|\n)([^\n\.]+)(?:\s*)(?:Itinerary|Travel Plan)/i,
	];

	for (const pattern of titlePatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			return match[1].trim();
		}
	}

	return null;
}

/**
 * Extracts a description from the itinerary content
 */
function extractDescription(content: string): string | null {
	// Look for the description after the title in markdown format
	const markdownDescriptionPattern = /(?:^|\n)# [^\n]+\n+([^\n#][^\n]+(?:\n[^\n#][^\n]+)*)/i;
	const markdownMatch = content.match(markdownDescriptionPattern);

	if (markdownMatch && markdownMatch[1]) {
		return markdownMatch[1].trim();
	}

	// Look for the first paragraph after the title
	const descriptionPatterns = [
		/(?:^|\n)(?:Itinerary|Travel Plan|Option)(?:\s*\d*\s*)?(?:\:|-)(?:\s*)(?:[^\n\.]+)[\.\n]+([\s\S]{10,150}?)(?:\n\n|\n\*|\n-|\n#)/i,
		/(?:^|\n)(?:Overview|Description|Summary)(?:\s*\:|)(?:\s*)([\s\S]{10,150}?)(?:\n\n|\n\*|\n-|\n#)/i,
	];

	for (const pattern of descriptionPatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			return match[1].trim();
		}
	}

	// If no description found, take the first paragraph
	const firstParagraph = content.split(/\n\n/)[0];
	if (firstParagraph && firstParagraph.length > 20 && firstParagraph.length < 200) {
		return firstParagraph.trim();
	}

	return null;
}

/**
 * Extracts the number of days from the itinerary content
 */
function extractDays(content: string): number {
	// Look for day-by-day section
	const dayByDayPattern = /## Day-by-Day Plan/i;
	if (dayByDayPattern.test(content)) {
		// Count the number of day mentions after this heading
		const daySection = content.split(/## Day-by-Day Plan/i)[1]?.split(/##/)[0] || "";
		const dayMatches = daySection.match(/Day \d+/gi);
		if (dayMatches && dayMatches.length > 0) {
			return dayMatches.length;
		}
	}

	// Look for day patterns
	const dayPatterns = [/(\d+)[\s-]*day(?:s)?\b/i, /Day\s+(\d+)/i];

	for (const pattern of dayPatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			const days = parseInt(match[1], 10);
			if (!isNaN(days) && days > 0) {
				return days;
			}
		}
	}

	// Count "Day X" occurrences
	const dayMatches = content.match(/Day\s+\d+/gi);
	if (dayMatches && dayMatches.length > 0) {
		return dayMatches.length;
	}

	// Default to 1 day if we can't determine
	return 1;
}

/**
 * Extracts highlights from the itinerary content
 */
function extractHighlights(content: string): ItineraryHighlight[] {
	const highlights: ItineraryHighlight[] = [];

	// Check for a dedicated highlights section
	const highlightsSection = content.match(/## Highlights\s+([\s\S]+?)(?:\n##|$)/i);
	if (highlightsSection && highlightsSection[1]) {
		const highlightItems = highlightsSection[1].match(/[-*•]\s+([^\n]+)/g);
		if (highlightItems && highlightItems.length > 0) {
			highlightItems.forEach((item) => {
				const cleanItem = item.replace(/[-*•]\s+/, "").trim();
				highlights.push({
					type: "activity",
					title: "Highlight",
					description: cleanItem,
				});
			});
		}
	}

	// Extract sections by heading
	extractSectionByHeading(content, "Accommodations", "hotel", highlights);
	extractSectionByHeading(content, "Transportation", "transportation", highlights);
	extractSectionByHeading(content, "Estimated Budget", "budget", highlights);

	// If we already have some highlights, return them
	if (highlights.length >= 3) {
		return highlights;
	}

	// Otherwise, use the old extraction methods
	extractLocations(content, highlights);
	extractBudget(content, highlights);
	extractAccommodations(content, highlights);
	extractActivities(content, highlights);
	extractTransportation(content, highlights);
	extractDining(content, highlights);

	return highlights;
}

/**
 * Extracts content from a section with a specific heading
 */
function extractSectionByHeading(
	content: string,
	heading: string,
	type: "location" | "budget" | "hotel" | "activity" | "transportation" | "restaurant" | "other",
	highlights: ItineraryHighlight[]
): void {
	const sectionPattern = new RegExp(`## ${heading}\\s+([\\s\\S]+?)(?:\\n##|$)`, "i");
	const sectionMatch = content.match(sectionPattern);

	if (sectionMatch && sectionMatch[1]) {
		const sectionContent = sectionMatch[1].trim();

		// Check if the section has bullet points
		const bulletPoints = sectionContent.match(/[-*•]\s+([^\n]+)/g);
		if (bulletPoints && bulletPoints.length > 0) {
			// Add each bullet point as a separate highlight
			bulletPoints.forEach((point, index) => {
				if (index < 3) {
					// Limit to 3 points per section
					const cleanPoint = point.replace(/[-*•]\s+/, "").trim();
					highlights.push({
						type,
						title: `${heading} ${index + 1}`,
						description: cleanPoint,
					});
				}
			});
		} else {
			// Add the whole section as one highlight
			highlights.push({
				type,
				title: heading,
				description:
					sectionContent.substring(0, 150) + (sectionContent.length > 150 ? "..." : ""),
			});
		}
	}
}

/**
 * Extracts location information from the content
 */
function extractLocations(content: string, highlights: ItineraryHighlight[]): void {
	// Look for destination/location patterns
	const locationPatterns = [
		/(?:Destination|Location)(?:s)?(?:\:|)(?:\s*)([^\n\.]+)/i,
		/(?:Visit|Explore|Discover)(?:\s+)([^\n\.,]+(?:,\s*[^\n\.,]+){0,5})/i,
		/(?:Trip to|Travel to)(?:\s+)([^\n\.,]+(?:,\s*[^\n\.,]+){0,5})/i,
	];

	for (const pattern of locationPatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			highlights.push({
				type: "location",
				title: "Main Destination",
				description: match[1].trim(),
			});
			break;
		}
	}

	// Look for cities/places mentioned
	const cityMatches = content.match(
		/(?:in|to|at|visit|explore)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g
	);
	if (cityMatches && cityMatches.length > 0) {
		const cities = new Set<string>();

		cityMatches.forEach((match) => {
			const city = match.replace(/(?:in|to|at|visit|explore)\s+/, "").trim();
			if (city.length > 3) {
				cities.add(city);
			}
		});

		if (cities.size > 0) {
			highlights.push({
				type: "location",
				title: "Places to Visit",
				description: Array.from(cities).join(", "),
			});
		}
	}
}

/**
 * Extracts budget information from the content
 */
function extractBudget(content: string, highlights: ItineraryHighlight[]): void {
	// Look for budget patterns
	const budgetPatterns = [
		/(?:Budget|Cost|Price)(?:\:|)(?:\s*)([^\n\.]+)/i,
		/(?:Estimated cost|Total cost|Approximate budget)(?:\:|)(?:\s*)([^\n\.]+)/i,
		/(?:\$|\€|\£)(?:\s*)(\d+(?:,\d+)?(?:\s*-\s*\$?\d+(?:,\d+)?)?)/i,
	];

	for (const pattern of budgetPatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			highlights.push({
				type: "budget",
				title: "Estimated Budget",
				description: match[1].trim(),
			});
			break;
		}
	}
}

/**
 * Extracts accommodation information from the content
 */
function extractAccommodations(content: string, highlights: ItineraryHighlight[]): void {
	// Look for accommodation patterns
	const accommodationPatterns = [
		/(?:Accommodation|Hotel|Stay|Lodging)(?:s)?(?:\:|)(?:\s*)([^\n\.]+)/i,
		/(?:Stay at|Book|Reserve)(?:\s+)([^\n\.]+(?:hotel|resort|inn|airbnb|apartment)[^\n\.]*)/i,
	];

	for (const pattern of accommodationPatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			highlights.push({
				type: "hotel",
				title: "Recommended Accommodation",
				description: match[1].trim(),
			});
			break;
		}
	}
}

/**
 * Extracts activity information from the content
 */
function extractActivities(content: string, highlights: ItineraryHighlight[]): void {
	// Look for activity patterns
	const activitySections = content.match(
		/(?:Activities|Things to do|Experiences|Attractions)(?:\:|)(?:\s*)([^\n]+(?:\n(?:\s*[-•*]\s*[^\n]+))+)/i
	);

	if (activitySections && activitySections[1]) {
		const activities = activitySections[1].match(/[-•*]\s*([^\n]+)/g);

		if (activities && activities.length > 0) {
			const cleanActivities = activities.map((act) => act.replace(/[-•*]\s*/, "").trim());

			highlights.push({
				type: "activity",
				title: "Top Activities",
				description: cleanActivities.slice(0, 3).join(", "),
			});
		}
	} else {
		// Look for individual activity mentions
		const activityPatterns = [
			/(?:Visit|Explore|Discover|Experience)(?:\s+)([^\n\.,]+(?:museum|park|garden|tour|temple|church|castle|palace)[^\n\.,]*)/gi,
			/(?:Enjoy|Try|Participate in)(?:\s+)([^\n\.,]+(?:tour|activity|adventure|experience)[^\n\.,]*)/gi,
		];

		for (const pattern of activityPatterns) {
			const matches = content.matchAll(pattern);
			const activities: string[] = [];

			for (const match of matches) {
				if (match[1]) {
					activities.push(match[1].trim());
				}
			}

			if (activities.length > 0) {
				highlights.push({
					type: "activity",
					title: "Suggested Activities",
					description: activities.slice(0, 3).join(", "),
				});
				break;
			}
		}
	}
}

/**
 * Extracts transportation information from the content
 */
function extractTransportation(content: string, highlights: ItineraryHighlight[]): void {
	// Look for transportation patterns
	const transportPatterns = [
		/(?:Transportation|Transport|Getting around)(?:\:|)(?:\s*)([^\n\.]+)/i,
		/(?:Travel by|Get around by|Use)(?:\s+)([^\n\.]+(?:car|bus|train|flight|plane|taxi|uber|ferry|boat)[^\n\.]*)/i,
	];

	for (const pattern of transportPatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			highlights.push({
				type: "transportation",
				title: "Transportation",
				description: match[1].trim(),
			});
			break;
		}
	}
}

/**
 * Extracts dining information from the content
 */
function extractDining(content: string, highlights: ItineraryHighlight[]): void {
	// Look for dining patterns
	const diningPatterns = [
		/(?:Dining|Food|Restaurants|Cuisine)(?:\:|)(?:\s*)([^\n\.]+)/i,
		/(?:Eat at|Try|Taste|Sample)(?:\s+)([^\n\.]+(?:restaurant|café|cafe|food|cuisine|dish)[^\n\.]*)/i,
	];

	for (const pattern of diningPatterns) {
		const match = content.match(pattern);
		if (match && match[1]) {
			highlights.push({
				type: "restaurant",
				title: "Dining Recommendations",
				description: match[1].trim(),
			});
			break;
		}
	}
}
