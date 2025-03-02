import React from "react";

interface WelcomeScreenProps {
	onCreateConversation: () => void;
	onSuggestedInput: (text: string) => void;
	hasActiveConversation: boolean;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
	onCreateConversation,
	onSuggestedInput,
	hasActiveConversation,
}) => {
	if (hasActiveConversation) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
				<div className="mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-16 w-16 text-blue-500 mb-2"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1}
							d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
				</div>
				<h3 className="text-xl font-bold text-gray-300 mb-2">
					Welcome to your travel planning assistant!
				</h3>
				<p className="max-w-md text-gray-400">
					Ask me about planning your next trip, finding destinations, or creating
					itineraries. I'm here to help make your travel dreams a reality.
				</p>
				<div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
					<button
						onClick={() => onSuggestedInput("Help me plan a trip to Japan")}
						className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
					>
						<span className="text-blue-400">→</span> Help me plan a trip to Japan
					</button>
					<button
						onClick={() => onSuggestedInput("What are the best beaches in Thailand?")}
						className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
					>
						<span className="text-blue-400">→</span> What are the best beaches in
						Thailand?
					</button>
					<button
						onClick={() =>
							onSuggestedInput("I need a 3-day itinerary for New York City")
						}
						className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
					>
						<span className="text-blue-400">→</span> I need a 3-day itinerary for NYC
					</button>
					<button
						onClick={() => onSuggestedInput("What's the best time to visit Europe?")}
						className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
					>
						<span className="text-blue-400">→</span> Best time to visit Europe?
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
			<div className="mb-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="h-16 w-16 text-blue-500 mb-2"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1}
						d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h3 className="text-xl font-bold text-gray-300 mb-2">Start a new conversation</h3>
			<p className="max-w-md text-gray-400">
				Create a new chat or select an existing one from the sidebar.
			</p>
			<button
				onClick={onCreateConversation}
				className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
			>
				New Conversation
			</button>
		</div>
	);
};

export default WelcomeScreen;
