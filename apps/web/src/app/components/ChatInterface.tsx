"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import ChatSidebar from "./ChatSidebar";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import WelcomeScreen from "./WelcomeScreen";
import ErrorMessage from "./ErrorMessage";
import ChatHeader from "./ChatHeader";
import { Message, ApiMessage, ConversationHistory, ApiResponse } from "./types";

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
