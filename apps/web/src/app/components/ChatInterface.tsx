"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import ChatSidebar from "./ChatSidebar";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import WelcomeScreen from "./WelcomeScreen";
import ErrorMessage from "./ErrorMessage";
import ChatHeader from "./ChatHeader";
import ItineraryDisplay from "./ItineraryDisplay";
import {
	Message,
	ApiMessage,
	ConversationHistory,
	ApiResponse,
	ItineraryData,
	AppView,
	ItineraryOption,
	ItineraryDay,
} from "./types";

// Mock user ID for demo purposes
const MOCK_USER_ID = "user-" + Math.random().toString(36).substring(2, 9);

// API base URL
const API_BASE_URL = "http://localhost:4000/api";

export default function ChatInterface() {
	const [socket, setSocket] = useState<Socket | null>(null);
	const [connected, setConnected] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [typing, setTyping] = useState(false);
	const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [receivedMessageIds, setReceivedMessageIds] = useState<Set<string>>(new Set());
	const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
	const [itineraryData, setItineraryData] = useState<ItineraryData | null>(null);

	// Initialize socket connection
	useEffect(() => {
		const newSocket = io("http://localhost:4000", {
			transports: ["websocket", "polling"],
			autoConnect: true,
			reconnection: true,
			reconnectionAttempts: 5,
		});

		newSocket.on("connect", () => {
			console.log("Socket connected");
			setConnected(true);
			setError(null);

			// Identify the user to the server
			newSocket.emit("identify", { userId: MOCK_USER_ID }, (response: any) => {
				console.log("Identify response:", response);
				if (!response.success) {
					setError("Failed to identify user");
				}
			});
		});

		newSocket.on("disconnect", () => {
			console.log("Socket disconnected");
			setConnected(false);
		});

		// Add this to listen for all events for debugging
		newSocket.onAny((event, ...args) => {
			console.log(`Received event: ${event}`, args);
		});

		newSocket.on("message_received", (data: any) => {
			console.log("Message received:", data);

			// Check for duplicate messages
			if (data.id && receivedMessageIds.has(data.id)) {
				console.warn(`Duplicate message received and ignored: ${data.id}`);
				return;
			}

			// Add message ID to the set of received messages
			if (data.id) {
				setReceivedMessageIds((prev) => new Set(prev).add(data.id));
			}

			setMessages((prev) => [
				...prev,
				{
					id: data.id,
					content: data.content,
					isUser: false,
					timestamp: new Date(data.timestamp),
				},
			]);
			setTyping(false);
		});

		// Add listener for itinerary generation events
		newSocket.on("itinerary_generated", (data: any) => {
			console.log("Itinerary received:", data);

			// Format the received itinerary data
			const formattedData: ItineraryData = {
				id: data.id,
				options: data.options,
				timestamp: new Date(data.timestamp),
			};

			// Store the itinerary data
			setItineraryData(formattedData);

			// Switch to the itinerary view
			setCurrentView(AppView.ITINERARY);
		});

		// Add error handling
		newSocket.on("connect_error", (error) => {
			console.error("Connection error:", error);
			setError("Failed to connect to server");
		});

		setSocket(newSocket);

		return () => {
			newSocket.disconnect();
		};
	}, [receivedMessageIds]);

	// Reset received message IDs when switching conversations
	useEffect(() => {
		if (activeConversationId) {
			setReceivedMessageIds(new Set());
		}
	}, [activeConversationId]);

	// Fetch user conversations using HTTP
	const fetchUserConversations = async () => {
		try {
			setError(null);
			const response = await fetch(`${API_BASE_URL}/conversations?userId=${MOCK_USER_ID}`);
			const data: ApiResponse<ConversationHistory[]> = await response.json();

			console.log("Fetch conversations response:", data);

			if (data.success && data.data) {
				// Format dates
				const formattedConversations = data.data.map((conv) => ({
					...conv,
					timestamp: new Date(conv.updatedAt || conv.createdAt || Date.now()),
				}));

				setConversationHistory(formattedConversations);

				// If we have conversations and no active one, set the first as active
				if (formattedConversations.length > 0 && !activeConversationId) {
					setActiveConversationId(formattedConversations[0].id);
					fetchConversationMessages(formattedConversations[0].id);
				}
			} else if (data.error) {
				setError(data.error);
				console.error("Failed to fetch conversations:", data.error);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			setError(`Error fetching user conversations: ${errorMessage}`);
			console.error("Error fetching user conversations:", error);
		}
	};

	// Fetch conversation messages using HTTP
	const fetchConversationMessages = async (conversationId: string) => {
		try {
			setError(null);
			const response = await fetch(
				`${API_BASE_URL}/conversations/${conversationId}/messages`
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `HTTP error ${response.status}`);
			}

			const data: ApiResponse<ApiMessage[]> = await response.json();

			console.log("Fetch messages response:", data);

			if (data.success && data.data) {
				// Format and set messages from history
				const formattedMessages = data.data.map((msg: ApiMessage) => ({
					id: msg.id,
					content: msg.content,
					isUser: msg.role === "user",
					timestamp: new Date(msg.timestamp),
				}));

				// Sort messages by timestamp to ensure proper conversation flow
				formattedMessages.sort(
					(a: Message, b: Message) => a.timestamp.getTime() - b.timestamp.getTime()
				);

				setMessages(formattedMessages);
			} else if (data.error) {
				setError(data.error);
				console.error("Failed to fetch conversation messages:", data.error);
				setMessages([]);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			setError(`Error fetching conversation messages: ${errorMessage}`);
			console.error("Error fetching conversation messages:", error);
			setMessages([]);
		}
	};

	// Load user conversations when connected
	useEffect(() => {
		if (connected) {
			fetchUserConversations();
		}
	}, [connected]);

	// Handle sending a message
	const handleSendMessage = (message: string) => {
		if (!socket || !connected || !message.trim() || !activeConversationId) return;

		// Create a temporary message ID
		const tempId = "temp-" + Date.now();

		// Add user message to the UI immediately
		const userMessage = {
			id: tempId,
			content: message,
			isUser: true,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setTyping(true);
		setError(null);

		// If we're in itinerary view, switch back to chat view
		if (currentView === AppView.ITINERARY) {
			setCurrentView(AppView.CHAT);
		}

		// Send message to server
		socket.emit(
			"send_message",
			{ userId: MOCK_USER_ID, conversationId: activeConversationId, message },
			(response: any) => {
				console.log("Send message response:", response);
				if (!response.success) {
					setError(`Failed to send message: ${response.error || "Unknown error"}`);
					console.error("Failed to send message:", response.error);
				}
			}
		);
	};

	// Extract itinerary data from AI messages
	const extractItineraryData = (): ItineraryData | null => {
		// Find messages that contain itinerary information
		const aiMessages = messages.filter((m) => !m.isUser);
		if (aiMessages.length === 0) return null;

		// Look for destination, duration, and travelers info
		let destination = "Travel Destination";
		let duration = "7 days";
		let travelers = "1-2 people";

		// Try to extract these details from the conversation
		for (const msg of aiMessages) {
			const content = msg.content;

			// Extract destination
			const destinationMatch = content.match(
				/(?:to|in|for|visiting)\s+([A-Z][a-zA-Z\s]+)(?:\.|\?|,|\s|$)/
			);
			if (destinationMatch && destinationMatch[1] && destinationMatch[1].length > 3) {
				destination = destinationMatch[1].trim();
			}

			// Extract duration
			const durationMatch = content.match(/(\d+)\s*(?:day|days|night|nights)/i);
			if (durationMatch) {
				duration = `${durationMatch[1]} days`;
			}

			// Extract travelers
			const travelersMatch = content.match(
				/(\d+(?:-\d+)?)\s*(?:person|people|traveler|travelers|guest|guests)/i
			);
			if (travelersMatch) {
				travelers = `${travelersMatch[1]} people`;
			}
		}

		// Extract the three itinerary options
		const options: ItineraryOption[] = [];

		// Look for the last AI message that likely contains all options
		const lastRelevantMessage = aiMessages
			.reverse()
			.find(
				(msg) =>
					msg.content.toLowerCase().includes("option 1") &&
					msg.content.toLowerCase().includes("option 2") &&
					msg.content.toLowerCase().includes("option 3")
			);

		if (lastRelevantMessage) {
			const content = lastRelevantMessage.content;

			// Split the content into sections for each option
			const optionSections = content.split(/Option \d+:|OPTION \d+:/);

			// Process each option (skip the first element which is text before "Option 1:")
			for (let i = 1; i <= 3 && i < optionSections.length; i++) {
				const section = optionSections[i];
				if (!section) continue;

				// Extract option title
				const titleMatch = section.match(/([^:.,\n]+)/);
				const title = titleMatch ? `Option ${i}: ${titleMatch[1].trim()}` : `Option ${i}`;

				// Extract description
				const descLines = section
					.split("\n")
					.filter(
						(line) =>
							line.length > 20 &&
							!line.includes("$") &&
							!line.includes("USD") &&
							!line.toLowerCase().includes("highlight")
					);
				const description =
					descLines.length > 0 ? descLines[0].trim() : "Explore this exciting option.";

				// Extract highlights
				const highlights: string[] = [];
				const highlightSection = section.toLowerCase().includes("highlight")
					? section.substring(section.toLowerCase().indexOf("highlight"))
					: section;

				const highlightMatches = highlightSection.match(/[-•*]\s*([^-•*\n]+)/g);
				if (highlightMatches) {
					highlightMatches.slice(0, 3).forEach((match) => {
						const cleanedHighlight = match.replace(/[-•*]\s*/, "").trim();
						if (cleanedHighlight) highlights.push(cleanedHighlight);
					});
				}

				// If no highlights found, create some based on the title
				if (highlights.length === 0) {
					if (i === 1) {
						highlights.push(
							"Authentic local experiences",
							"Historical sites",
							"Traditional cuisine"
						);
					} else if (i === 2) {
						highlights.push(
							"Outdoor activities",
							"Natural wonders",
							"Active experiences"
						);
					} else {
						highlights.push(
							"Spa treatments",
							"Wellness activities",
							"Peaceful settings"
						);
					}
				}

				// Create days with activities
				const days: ItineraryDay[] = [];
				for (let d = 1; d <= 7; d++) {
					days.push({
						day: d,
						title: `Day ${d}: ${d === 1 ? "Arrival & Exploration" : "Adventure Day " + d}`,
						activities: [
							{
								time: "Morning",
								activity:
									i === 1
										? "Local Tour"
										: i === 2
											? "Hiking Expedition"
											: "Yoga Session",
								description:
									i === 1
										? "Explore the area with a local guide"
										: i === 2
											? "Explore natural trails and scenic views"
											: "Start the day with gentle exercise",
								location:
									i === 1
										? "City Center"
										: i === 2
											? "Mountain Region"
											: "Beach Front",
							},
							{
								time: "Afternoon",
								activity:
									i === 1
										? "Historical Site Visit"
										: i === 2
											? "Outdoor Adventure"
											: "Spa Treatment",
								description:
									i === 1
										? "Visit important cultural landmarks"
										: i === 2
											? "Exciting activity in nature"
											: "Relaxing massage and wellness therapy",
								location:
									i === 1
										? "Historical District"
										: i === 2
											? "Adventure Park"
											: "Luxury Spa",
							},
							{
								time: "Evening",
								activity:
									i === 1
										? "Traditional Dinner"
										: i === 2
											? "Campfire Dinner"
											: "Sunset Meditation",
								description:
									i === 1
										? "Taste authentic local cuisine"
										: i === 2
											? "Relaxing evening meal outdoors"
											: "Guided relaxation session",
								location:
									i === 1
										? "Old Town"
										: i === 2
											? "Base Camp"
											: "Tranquility Garden",
							},
						],
					});
				}

				// Extract estimated cost
				let estimatedCost = {
					amount: i === 1 ? 1500 : i === 2 ? 1700 : 2000,
					currency: "USD",
				};

				const costMatch = section.match(/\$(\d+,?\d*)/);
				if (costMatch) {
					estimatedCost.amount = parseInt(costMatch[1].replace(",", ""));
				}

				// Add the option
				options.push({
					title,
					description,
					highlights,
					days,
					estimatedCost,
				});
			}
		}

		// If we couldn't extract options, create default ones
		if (options.length === 0) {
			options.push(
				{
					title: "Option 1: Cultural Immersion",
					highlights: [
						"Authentic local experiences",
						"Historical sites",
						"Traditional cuisine",
					],
					description:
						"A journey focused on experiencing the local culture, history and food.",
					days: Array.from({ length: 7 }, (_, i) => ({
						day: i + 1,
						title: `Day ${i + 1}: ${i === 0 ? "Arrival & Exploration" : "Adventure Day " + (i + 1)}`,
						activities: [
							{
								time: "Morning",
								activity: "Local Tour",
								description: "Explore the area with a local guide",
								location: "City Center",
							},
							{
								time: "Afternoon",
								activity: "Historical Site Visit",
								description: "Visit important cultural landmarks",
								location: "Historical District",
							},
							{
								time: "Evening",
								activity: "Traditional Dinner",
								description: "Taste authentic local cuisine",
								location: "Old Town",
							},
						],
					})),
					estimatedCost: {
						amount: 1500,
						currency: "USD",
					},
				},
				{
					title: "Option 2: Adventure Explorer",
					highlights: ["Outdoor activities", "Natural wonders", "Active experiences"],
					description:
						"An adventure-focused trip with emphasis on nature and outdoor activities.",
					days: Array.from({ length: 7 }, (_, i) => ({
						day: i + 1,
						title: `Day ${i + 1}: ${i === 0 ? "Arrival & Setup" : "Exploration Day " + (i + 1)}`,
						activities: [
							{
								time: "Morning",
								activity: "Hiking Expedition",
								description: "Explore natural trails and scenic views",
								location: "Mountain Region",
							},
							{
								time: "Afternoon",
								activity: "Outdoor Adventure",
								description: "Exciting activity in nature",
								location: "Adventure Park",
							},
							{
								time: "Evening",
								activity: "Campfire Dinner",
								description: "Relaxing evening meal outdoors",
								location: "Base Camp",
							},
						],
					})),
					estimatedCost: {
						amount: 1700,
						currency: "USD",
					},
				},
				{
					title: "Option 3: Relaxation Retreat",
					highlights: ["Spa treatments", "Wellness activities", "Peaceful settings"],
					description: "A rejuvenating trip focused on relaxation and wellness.",
					days: Array.from({ length: 7 }, (_, i) => ({
						day: i + 1,
						title: `Day ${i + 1}: ${i === 0 ? "Arrival & Unwinding" : "Wellness Day " + (i + 1)}`,
						activities: [
							{
								time: "Morning",
								activity: "Yoga Session",
								description: "Start the day with gentle exercise",
								location: "Beach Front",
							},
							{
								time: "Afternoon",
								activity: "Spa Treatment",
								description: "Relaxing massage and wellness therapy",
								location: "Luxury Spa",
							},
							{
								time: "Evening",
								activity: "Sunset Meditation",
								description: "Guided relaxation session",
								location: "Tranquility Garden",
							},
						],
					})),
					estimatedCost: {
						amount: 2000,
						currency: "USD",
					},
				}
			);
		}

		return {
			id: "itinerary-" + Date.now(),
			options: {
				destination,
				duration,
				travelers,
				options,
			},
			timestamp: new Date(),
		};
	};

	// Handle going back to chat from itinerary view
	const handleBackToChat = () => {
		setCurrentView(AppView.CHAT);
	};

	// Handle editing an itinerary
	const handleEditItinerary = (feedback: string) => {
		if (!socket || !connected || !activeConversationId) return;

		// Switch back to chat view
		setCurrentView(AppView.CHAT);

		// Send the feedback message
		handleSendMessage(feedback);
	};

	// Handle suggested input
	const setSuggestedInput = (text: string) => {
		if (!socket || !connected || !activeConversationId) return;
		handleSendMessage(text);
	};

	// Create a new conversation
	const handleCreateConversation = () => {
		if (!socket || !connected) return;

		setError(null);
		socket.emit(
			"create_conversation",
			{ userId: MOCK_USER_ID, title: "New Travel Plan" },
			(response: any) => {
				console.log("Create conversation response:", response);
				if (response.success) {
					// Add to conversation history
					const newConversation = {
						id: response.conversationId,
						title: response.title,
						lastMessage: "",
						timestamp: new Date(),
					};

					setConversationHistory((prev) => [newConversation, ...prev]);
					setActiveConversationId(response.conversationId);
					setMessages([]);
				} else {
					setError(`Failed to create conversation: ${response.error || "Unknown error"}`);
				}
			}
		);
	};

	// Switch to a different conversation
	const handleSwitchConversation = (conversationId: string) => {
		setTyping(false);
		setMessages([]);
		setActiveConversationId(conversationId);
		setError(null);

		// Fetch conversation messages using HTTP
		fetchConversationMessages(conversationId);
	};

	// Get active conversation title
	const getActiveConversationTitle = () => {
		if (!activeConversationId) return "Travel Assistant";

		const activeConv = conversationHistory.find((c) => c.id === activeConversationId);
		return activeConv ? activeConv.title : "Travel Assistant";
	};

	return (
		<div className="flex h-screen bg-gray-900 text-gray-100">
			{/* Sidebar - only shown in chat view */}
			{currentView === AppView.CHAT && (
				<ChatSidebar
					sidebarOpen={sidebarOpen}
					conversationHistory={conversationHistory}
					activeConversationId={activeConversationId}
					connected={connected}
					onCreateConversation={handleCreateConversation}
					onSwitchConversation={handleSwitchConversation}
				/>
			)}

			{/* Main Content Area */}
			{currentView === AppView.CHAT ? (
				/* Chat View */
				<div className="flex-1 flex flex-col h-full">
					{/* Chat header */}
					<ChatHeader
						title={getActiveConversationTitle()}
						conversationId={activeConversationId}
						onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
					/>

					{/* Messages area */}
					<div className="flex-1 p-4 overflow-y-auto bg-gray-900">
						{/* Error message */}
						<ErrorMessage message={error} onDismiss={() => setError(null)} />

						{!activeConversationId ? (
							<WelcomeScreen
								onCreateConversation={handleCreateConversation}
								onSuggestedInput={setSuggestedInput}
								hasActiveConversation={false}
							/>
						) : messages.length === 0 ? (
							<WelcomeScreen
								onCreateConversation={handleCreateConversation}
								onSuggestedInput={setSuggestedInput}
								hasActiveConversation={true}
							/>
						) : (
							<MessageList
								messages={messages}
								typing={typing}
								onViewItineraries={() => {
									// Extract itinerary data from AI messages
									const extractedData = extractItineraryData();
									if (extractedData) {
										setItineraryData(extractedData);
										setCurrentView(AppView.ITINERARY);
									} else {
										setError(
											"Failed to generate itinerary options. Please try again."
										);
									}
								}}
							/>
						)}
					</div>

					{/* Input area */}
					<MessageInput
						connected={connected}
						activeConversationId={activeConversationId}
						onSendMessage={handleSendMessage}
					/>
				</div>
			) : (
				/* Itinerary View */
				itineraryData && (
					<ItineraryDisplay
						itineraryData={itineraryData}
						onBackToChat={handleBackToChat}
						onEditItinerary={handleEditItinerary}
					/>
				)
			)}
		</div>
	);
}
