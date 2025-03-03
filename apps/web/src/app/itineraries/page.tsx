"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ItinerariesPage from "../components/ItinerariesPage";
import { Itinerary } from "../components/types";

export default function ItinerariesView() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [itineraries, setItineraries] = useState<Itinerary[]>([]);
	const [activeItineraryId, setActiveItineraryId] = useState<string | null>(null);

	// Load itineraries from localStorage
	useEffect(() => {
		console.log("Itineraries page mounted, loading data from localStorage");
		try {
			if (typeof window !== "undefined") {
				const storedItineraries = localStorage.getItem("itineraries");
				console.log("Raw stored itineraries:", storedItineraries);

				if (!storedItineraries) {
					console.warn("No itineraries found in localStorage");
					setError("No itineraries found. Please create a travel plan first.");
					setLoading(false);
					return;
				}

				const parsed = JSON.parse(storedItineraries);
				console.log("Parsed itineraries:", parsed);

				if (Array.isArray(parsed) && parsed.length > 0) {
					const formattedItineraries = parsed.map((itinerary) => ({
						...itinerary,
						createdAt: new Date(itinerary.createdAt),
					}));

					console.log("Formatted itineraries:", formattedItineraries);
					setItineraries(formattedItineraries);

					// Set active itinerary from URL or use the first one
					const id = searchParams.get("id");
					if (id && formattedItineraries.some((i) => i.id === id)) {
						setActiveItineraryId(id);
					} else {
						setActiveItineraryId(formattedItineraries[0].id);
					}
				} else {
					console.warn("Invalid itineraries format in localStorage");
					setError("Invalid itineraries data. Please create a new travel plan.");
				}
			}
		} catch (err) {
			console.error("Error loading itineraries:", err);
			setError("Failed to load itineraries. Please try again.");
		} finally {
			setLoading(false);
		}
	}, [searchParams]);

	// If no itineraries are available, redirect to home
	useEffect(() => {
		if (!loading && itineraries.length === 0 && !error) {
			console.log("No itineraries found, redirecting to home");
			router.push("/");
		}
	}, [itineraries.length, router, loading, error]);

	// Handle itinerary selection
	const handleSelectItinerary = (id: string) => {
		console.log("Selecting itinerary:", id);
		setActiveItineraryId(id);
		router.push(`/itineraries?id=${id}`);
	};

	// Handle close
	const handleClose = () => {
		console.log("Closing itineraries page");
		router.push("/");
	};

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-900 text-gray-100">
				<div className="text-center">
					<div className="mb-4">
						<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
					</div>
					<p>Loading itineraries...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-900 text-gray-100">
				<div className="max-w-md p-6 bg-gray-800 rounded-lg shadow-lg text-center">
					<h2 className="text-xl font-bold mb-4">Error</h2>
					<p className="mb-6">{error}</p>
					<button
						onClick={() => router.push("/")}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
					>
						Return to Chat
					</button>
				</div>
			</div>
		);
	}

	if (itineraries.length === 0) {
		return null; // Will redirect in useEffect
	}

	return (
		<ItinerariesPage
			itineraries={itineraries}
			activeItineraryId={activeItineraryId}
			onSelectItinerary={handleSelectItinerary}
			onClose={handleClose}
		/>
	);
}
