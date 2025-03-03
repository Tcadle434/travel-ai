"use client";

import { useState } from "react";
import { Itinerary, ItineraryHighlight } from "./types";

interface ItinerariesPageProps {
	itineraries: Itinerary[];
	activeItineraryId: string | null;
	onSelectItinerary: (id: string) => void;
	onClose: () => void;
}

const ItinerariesPage: React.FC<ItinerariesPageProps> = ({
	itineraries,
	activeItineraryId,
	onSelectItinerary,
	onClose,
}) => {
	const [activeTab, setActiveTab] = useState<"overview" | "details" | "booking">("overview");

	// Find the active itinerary
	const activeItinerary =
		itineraries.find((itinerary) => itinerary.id === activeItineraryId) || itineraries[0];

	// Group highlights by type
	const groupedHighlights = activeItinerary?.highlights.reduce(
		(groups, highlight) => {
			if (!groups[highlight.type]) {
				groups[highlight.type] = [];
			}
			groups[highlight.type].push(highlight);
			return groups;
		},
		{} as Record<string, ItineraryHighlight[]>
	);

	// Helper function to get icon for highlight type
	const getHighlightIcon = (type: string) => {
		switch (type) {
			case "location":
				return "🌍";
			case "budget":
				return "💰";
			case "hotel":
				return "🏨";
			case "activity":
				return "🎯";
			case "transportation":
				return "🚗";
			case "restaurant":
				return "🍽️";
			default:
				return "📌";
		}
	};

	// Helper function to get title for highlight type
	const getHighlightTypeTitle = (type: string) => {
		switch (type) {
			case "location":
				return "Destinations";
			case "budget":
				return "Budget";
			case "hotel":
				return "Accommodations";
			case "activity":
				return "Activities";
			case "transportation":
				return "Transportation";
			case "restaurant":
				return "Dining";
			default:
				return "Other Details";
		}
	};

	return (
		<div className="fixed inset-0 bg-gray-900 text-gray-100 z-50 flex flex-col">
			{/* Header */}
			<div className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
				<h1 className="text-xl font-bold">Your Travel Itineraries</h1>
				<button
					onClick={onClose}
					className="p-2 rounded-full hover:bg-gray-700 transition-colors"
					aria-label="Close"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			{/* Main content */}
			<div className="flex flex-1 overflow-hidden">
				{/* Sidebar with itinerary cards */}
				<div className="w-1/4 border-r border-gray-700 overflow-y-auto p-4 bg-gray-800">
					<h2 className="text-lg font-semibold mb-4">Your Itineraries</h2>
					<div className="space-y-4">
						{itineraries.map((itinerary) => (
							<div
								key={itinerary.id}
								className={`p-4 rounded-lg cursor-pointer transition-colors ${
									itinerary.id === activeItineraryId
										? "bg-blue-600"
										: "bg-gray-700 hover:bg-gray-600"
								}`}
								onClick={() => onSelectItinerary(itinerary.id)}
							>
								<h3 className="font-medium text-lg">{itinerary.title}</h3>
								<p className="text-sm text-gray-300 mt-1">
									{itinerary.description}
								</p>
								<div className="mt-2 text-xs text-gray-400">
									{itinerary.days} days • Created{" "}
									{itinerary.createdAt.toLocaleDateString()}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Main content area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{/* Tabs */}
					<div className="bg-gray-800 border-b border-gray-700">
						<div className="flex">
							<button
								className={`px-4 py-3 font-medium ${
									activeTab === "overview"
										? "border-b-2 border-blue-500 text-blue-400"
										: "text-gray-400 hover:text-gray-200"
								}`}
								onClick={() => setActiveTab("overview")}
							>
								Overview
							</button>
							<button
								className={`px-4 py-3 font-medium ${
									activeTab === "details"
										? "border-b-2 border-blue-500 text-blue-400"
										: "text-gray-400 hover:text-gray-200"
								}`}
								onClick={() => setActiveTab("details")}
							>
								Full Details
							</button>
							<button
								className={`px-4 py-3 font-medium ${
									activeTab === "booking"
										? "border-b-2 border-blue-500 text-blue-400"
										: "text-gray-400 hover:text-gray-200"
								}`}
								onClick={() => setActiveTab("booking")}
							>
								Booking Options
							</button>
						</div>
					</div>

					{/* Tab content */}
					<div className="flex-1 overflow-y-auto p-6">
						{activeTab === "overview" && activeItinerary && (
							<div>
								<h2 className="text-2xl font-bold mb-6">{activeItinerary.title}</h2>
								<p className="text-gray-300 mb-8">{activeItinerary.description}</p>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									{Object.keys(groupedHighlights || {}).map((type) => (
										<div
											key={type}
											className="bg-gray-800 rounded-lg p-5 border border-gray-700"
										>
											<h3 className="text-lg font-semibold mb-3 flex items-center">
												<span className="mr-2">
													{getHighlightIcon(type)}
												</span>
												{getHighlightTypeTitle(type)}
											</h3>
											<ul className="space-y-3">
												{groupedHighlights[type].map((highlight, index) => (
													<li key={index} className="text-gray-300">
														<div className="font-medium">
															{highlight.title}
														</div>
														<div className="text-sm text-gray-400">
															{highlight.description}
														</div>
													</li>
												))}
											</ul>
										</div>
									))}
								</div>
							</div>
						)}

						{activeTab === "details" && activeItinerary && (
							<div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
								<h2 className="text-2xl font-bold mb-4">{activeItinerary.title}</h2>
								<div className="whitespace-pre-wrap text-gray-300">
									{activeItinerary.fullContent}
								</div>
							</div>
						)}

						{activeTab === "booking" && (
							<div className="space-y-8">
								<div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
									<h3 className="text-xl font-semibold mb-4 flex items-center">
										<span className="mr-2">✈️</span>Flight Options
									</h3>
									<p className="text-gray-400 mb-4">
										Connect with flight APIs to book your travel.
									</p>
									<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
										Coming Soon
									</button>
								</div>

								<div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
									<h3 className="text-xl font-semibold mb-4 flex items-center">
										<span className="mr-2">🏨</span>Accommodation Options
									</h3>
									<p className="text-gray-400 mb-4">
										Find and book hotels or Airbnb stays for your trip.
									</p>
									<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
										Coming Soon
									</button>
								</div>

								<div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
									<h3 className="text-xl font-semibold mb-4 flex items-center">
										<span className="mr-2">🍽️</span>Restaurant Reservations
									</h3>
									<p className="text-gray-400 mb-4">
										Make reservations at recommended restaurants.
									</p>
									<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
										Coming Soon
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ItinerariesPage;
