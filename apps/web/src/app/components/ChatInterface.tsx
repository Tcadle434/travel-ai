"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import ChatSidebar from "./ChatSidebar";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import WelcomeScreen from "./WelcomeScreen";
import ErrorMessage from "./ErrorMessage";
import ChatHeader from "./ChatHeader";
import { ApiMessage, ConversationHistory, ApiResponse, Itinerary } from "./types";
import { Message } from "../../types/message";
import { parseItinerariesFromContent } from "../utils/itineraryParser";

// Mock user ID for demo purposes
const MOCK_USER_ID = "user-" + Math.random().toString(36).substring(2, 9);

// API base URL
const API_BASE_URL = "http://localhost:4000/api";

export default function ChatInterface() {
	const router = useRouter();
	const [socket, setSocket] = useState<Socket | null>(null);
	const [connected, setConnected] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [typing, setTyping] = useState(false);
	const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [receivedMessageIds, setReceivedMessageIds] = useState<Set<string>>(new Set());
	const [itineraries, setItineraries] = useState<Itinerary[]>([]);

	// Initialize socket connection
	useEffect(() => {
		// Initialize socket connection even without an active conversation
		const newSocket = io("http://localhost:4000", {
			transports: ["websocket", "polling"],
			autoConnect: true,
			reconnection: true,
			reconnectionAttempts: 5,
		});

		// Set up event listeners
		newSocket.on("connect", () => {
			console.log("Socket connected");
			setConnected(true);

			// Join the conversation room if we have an active conversation
			if (activeConversationId) {
				newSocket.emit("join_conversation", { conversationId: activeConversationId });
			}
		});

		newSocket.on("disconnect", () => {
			console.log("Socket disconnected");
			setConnected(false);
		});

		newSocket.on("message", (message: Message) => {
			console.log("Received message:", message);

			// Handle chunked messages
			if (message.metadata?.isChunk) {
				console.log(
					`Received chunk ${(message.metadata.chunkIndex || 0) + 1}/${message.metadata.totalChunks || 1}`
				);

				// Add the chunk to the messages
				setMessages((prev) => {
					// Check if we already have this chunk (avoid duplicates)
					const existingChunk = prev.find(
						(m) =>
							m.metadata?.isChunk &&
							m.metadata.chunkIndex === message.metadata?.chunkIndex
					);

					if (existingChunk) {
						return prev;
					}

					return [...prev, message];
				});
			} else {
				// Regular message handling
				setMessages((prev) => {
					// Replace temporary message if it exists
					const tempIndex = prev.findIndex((m) => m.id === "temp-" + Date.now());
					if (tempIndex !== -1) {
						const newMessages = [...prev];
						newMessages[tempIndex] = message;
						return newMessages;
					}
					return [...prev, message];
				});
			}

			setTyping(false);
		});

		// Handle itineraries complete notification
		newSocket.on("itineraries_complete", (data: any) => {
			console.log("Itineraries complete:", data);

			// Combine all message chunks to get the full content
			const fullContent = combineMessageChunks();

			// Save itineraries to localStorage
			if (fullContent) {
				localStorage.setItem("itineraries", fullContent);

				// Redirect to itineraries page
				window.location.href = "/itineraries";
			}
		});

		setSocket(newSocket);

		// Clean up on unmount
		return () => {
			newSocket.disconnect();
		};
	}, [activeConversationId]); // Keep the dependency array, but we'll connect regardless

	// Helper function to combine message chunks
	const combineMessageChunks = () => {
		// Get all AI message chunks in order
		const chunks = messages
			.filter((m) => !m.isUser && m.metadata?.isChunk)
			.sort((a, b) => (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0));

		if (chunks.length === 0) {
			// If no chunks, get the last AI message
			const lastAiMessage = [...messages].filter((m) => !m.isUser).pop();

			return lastAiMessage?.content || "";
		}

		// Combine chunks
		return chunks.map((chunk) => chunk.content).join("");
	};

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

				// Check if any of the messages contain itinerary information
				const allContent = formattedMessages
					.filter((msg) => !msg.isUser)
					.map((msg) => msg.content)
					.join("\n\n");

				const extractedItineraries = parseItinerariesFromContent(allContent);
				if (extractedItineraries.length > 0) {
					setItineraries(extractedItineraries);

					// Save to localStorage for persistence
					if (typeof window !== "undefined") {
						localStorage.setItem("itineraries", JSON.stringify(extractedItineraries));
					}
				}
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

		// Check if this message might be a travel planning request
		const isTravelRequest = detectTravelRequest(message);
		console.log(`Message travel request detection: ${isTravelRequest ? "YES" : "NO"}`);

		// Send message to server
		socket.emit(
			"send_message",
			{
				userId: MOCK_USER_ID,
				conversationId: activeConversationId,
				message,
				isTravelRequest, // Pass this flag to the server
			},
			(response: any) => {
				console.log("Send message response:", response);
				if (!response.success) {
					setError(`Failed to send message: ${response.error || "Unknown error"}`);
					console.error("Failed to send message:", response.error);
				}
			}
		);
	};

	// Helper function to detect if a message is likely a travel planning request
	const detectTravelRequest = (message: string): boolean => {
		const travelKeywords = [
			"travel",
			"trip",
			"vacation",
			"visit",
			"go to",
			"flight",
			"hotel",
			"beach",
			"mountain",
			"city",
			"tour",
			"itinerary",
			"plan",
			"holiday",
			"destination",
			"resort",
			"cruise",
			"adventure",
			"sightseeing",
			"where should i go",
			"where to go",
			"where to visit",
		];

		const lowercaseMessage = message.toLowerCase();

		// Check for travel keywords
		const hasTravelKeyword = travelKeywords.some((keyword) =>
			lowercaseMessage.includes(keyword)
		);

		// Check for question patterns about travel
		const isTravelQuestion =
			/\b(where|what|how|recommend|suggest)\b.*\b(go|visit|travel|vacation|trip|destination)\b/i.test(
				lowercaseMessage
			);

		// Check for location mentions
		const hasLocation = /\b(in|to)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\b/.test(message);

		return hasTravelKeyword || isTravelQuestion || hasLocation;
	};

	// Handle suggested input
	const setSuggestedInput = (text: string) => {
		if (!socket || !connected || !activeConversationId) return;
		handleSendMessage(text);
	};

	// Create a new conversation
	const handleCreateConversation = () => {
		if (!socket || !connected) {
			console.error("Cannot create conversation: Socket not connected");
			setError("Cannot create conversation: Not connected to server");
			return;
		}

		console.log("Creating new conversation...");
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

	// View itineraries
	const handleViewItineraries = () => {
		if (itineraries.length > 0) {
			router.push("/itineraries");
		}
	};

	return (
		<div className="flex h-screen bg-gray-900 text-gray-100">
			{/* Sidebar */}
			<ChatSidebar
				sidebarOpen={sidebarOpen}
				conversationHistory={conversationHistory}
				activeConversationId={activeConversationId}
				connected={connected}
				onCreateConversation={handleCreateConversation}
				onSwitchConversation={handleSwitchConversation}
			/>

			{/* Main Chat Area */}
			<div className="flex-1 flex flex-col h-full">
				{/* Chat header */}
				<ChatHeader
					title={getActiveConversationTitle()}
					conversationId={activeConversationId}
					onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
					hasItineraries={itineraries.length > 0}
					onViewItineraries={handleViewItineraries}
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
						<MessageList messages={messages} typing={typing} />
					)}
				</div>

				{/* Input area */}
				<MessageInput
					connected={connected}
					activeConversationId={activeConversationId}
					onSendMessage={handleSendMessage}
				/>
			</div>
		</div>
	);
}
