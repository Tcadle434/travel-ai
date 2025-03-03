import React, { useRef, useEffect, useState } from "react";
import { Message } from "./types";

interface MessageListProps {
	messages: Message[];
	typing: boolean;
	onViewItineraries?: () => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, typing, onViewItineraries }) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [showItineraryButton, setShowItineraryButton] = useState(false);

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Check if we should show the "View Itineraries" button
	useEffect(() => {
		// Only show button when AI has responded with complete itinerary options
		if (messages.length >= 2) {
			// Get the last AI message
			const aiMessages = messages.filter((m) => !m.isUser);
			const lastAIMessage = aiMessages[aiMessages.length - 1];

			if (lastAIMessage) {
				const content = lastAIMessage.content.toLowerCase();

				// Check for phrases indicating all itineraries have been generated
				const hasAllItineraries =
					(content.includes("option 1") &&
						content.includes("option 2") &&
						content.includes("option 3")) ||
					(content.includes("cultural immersion") &&
						content.includes("adventure explorer") &&
						content.includes("relaxation retreat")) ||
					(content.includes("itinerary options") &&
						content.includes("here are three") &&
						!content.includes("i'll prepare"));

				// Only show the button when all three options appear to be ready
				setShowItineraryButton(hasAllItineraries && !!onViewItineraries);
			}
		}
	}, [messages, onViewItineraries]);

	return (
		<div className="space-y-4 max-w-3xl mx-auto">
			{messages.map((msg) => (
				<div
					key={msg.id}
					className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
				>
					<div
						className={`max-w-md rounded-lg p-4 ${
							msg.isUser
								? "bg-blue-600 text-white rounded-br-none"
								: "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700"
						}`}
					>
						<p className="whitespace-pre-wrap">{msg.content}</p>
						<div
							className={`text-xs mt-2 ${
								msg.isUser ? "text-blue-200" : "text-gray-400"
							}`}
						>
							{msg.timestamp.toLocaleTimeString()}
						</div>
					</div>
				</div>
			))}

			{/* Itinerary Button */}
			{showItineraryButton && (
				<div className="flex justify-center my-4">
					<button
						onClick={onViewItineraries}
						className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-full shadow-lg transition-colors flex items-center"
					>
						<span className="mr-2">🗺️</span>
						View Itineraries
					</button>
				</div>
			)}

			{typing && (
				<div className="flex justify-start">
					<div className="bg-gray-800 text-gray-100 rounded-lg p-4 border border-gray-700 rounded-bl-none">
						<div className="flex space-x-2">
							<div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
							<div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-75"></div>
							<div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-150"></div>
						</div>
					</div>
				</div>
			)}
			<div ref={messagesEndRef} />
		</div>
	);
};

export default MessageList;
