"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// Mock user ID for demo purposes
const MOCK_USER_ID = "user-" + Math.random().toString(36).substring(2, 9);

// API base URL
const API_BASE_URL = "http://localhost:4000/api";

interface Message {
	id: string;
	content: string;
	isUser: boolean;
	timestamp: Date;
}

interface ConversationHistory {
	id: string;
	title: string;
	lastMessage: string;
	timestamp: Date;
}

export default function ChatInterface() {
	const [socket, setSocket] = useState<Socket | null>(null);
	const [connected, setConnected] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [typing, setTyping] = useState(false);
	const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

	const messagesEndRef = useRef<HTMLDivElement>(null);

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

			// Identify the user to the server
			newSocket.emit("identify", { userId: MOCK_USER_ID }, (response: any) => {
				console.log("Identify response:", response);
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
		});

		setSocket(newSocket);

		return () => {
			newSocket.disconnect();
		};
	}, []);

	// Fetch user conversations using HTTP
	const fetchUserConversations = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/conversations?userId=${MOCK_USER_ID}`);
			const data = await response.json();

			console.log("Fetch conversations response:", data);

			if (data.success && data.conversations) {
				setConversationHistory(data.conversations);

				// If we have conversations and no active one, set the first as active
				if (data.conversations.length > 0 && !activeConversationId) {
					setActiveConversationId(data.conversations[0].id);
					fetchConversationMessages(data.conversations[0].id);
				}
			}
		} catch (error) {
			console.error("Error fetching user conversations:", error);
		}
	};

	// Fetch conversation messages using HTTP
	const fetchConversationMessages = async (conversationId: string) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/conversations/${conversationId}/messages`
			);
			const data = await response.json();

			console.log("Fetch messages response:", data);

			if (data.success && data.messages) {
				// Format and set messages from history
				const formattedMessages = data.messages.map((msg: any) => ({
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
			} else {
				console.error("Failed to fetch conversation messages:", data.error);
				setMessages([]);
			}
		} catch (error) {
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

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Handle sending a message
	const handleSendMessage = () => {
		if (!socket || !connected || !input.trim() || !activeConversationId) return;

		// Create a temporary message ID
		const tempId = "temp-" + Date.now();

		// Add user message to the UI immediately
		const userMessage = {
			id: tempId,
			content: input,
			isUser: true,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setTyping(true);

		// Send message to server
		socket.emit(
			"send_message",
			{ userId: MOCK_USER_ID, conversationId: activeConversationId, message: input },
			(response: any) => {
				console.log("Send message response:", response);
				if (!response.success) {
					console.error("Failed to send message:", response.error);
				}
			}
		);
	};

	// Handle suggested input
	const setSuggestedInput = (text: string) => {
		setInput(text);
	};

	// Create a new conversation
	const handleCreateConversation = () => {
		if (!socket || !connected) return;

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
				}
			}
		);
	};

	// Switch to a different conversation
	const handleSwitchConversation = (conversationId: string) => {
		setTyping(false);
		setMessages([]);
		setActiveConversationId(conversationId);

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
			<div
				className={`${
					sidebarOpen ? "w-80" : "w-0 -ml-80"
				} bg-gray-800 transition-all duration-300 ease-in-out overflow-hidden flex flex-col h-full`}
			>
				<div className="p-4 border-b border-gray-700 flex items-center justify-between">
					<h2 className="text-xl font-bold text-blue-400">Conversations</h2>
					<button
						onClick={handleCreateConversation}
						className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
						title="New Conversation"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-5 w-5"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fillRule="evenodd"
								d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
								clipRule="evenodd"
							/>
						</svg>
					</button>
				</div>
				<div className="flex-1 overflow-y-auto">
					{conversationHistory.length === 0 ? (
						<div className="p-4 text-center text-gray-500">
							No conversations yet. Start a new one!
						</div>
					) : (
						conversationHistory.map((conv) => (
							<div
								key={conv.id}
								className={`p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors ${
									activeConversationId === conv.id ? "bg-gray-700" : ""
								}`}
								onClick={() => handleSwitchConversation(conv.id)}
							>
								<div className="font-medium text-blue-300">{conv.title}</div>
								<div className="text-sm text-gray-400 truncate">
									{conv.lastMessage}
								</div>
								<div className="text-xs text-gray-500 mt-1">
									{new Date(conv.timestamp).toLocaleDateString()}
								</div>
							</div>
						))
					)}
				</div>
				<div className="p-4 border-t border-gray-700">
					<div className="flex items-center space-x-2">
						<div
							className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
						></div>
						<span className="text-sm">{connected ? "Connected" : "Disconnected"}</span>
					</div>
				</div>
			</div>

			{/* Main Chat Area */}
			<div className="flex-1 flex flex-col h-full">
				{/* Chat header */}
				<div className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
					<div className="flex items-center">
						<button
							onClick={() => setSidebarOpen(!sidebarOpen)}
							className="mr-4 text-gray-400 hover:text-white transition-colors"
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
									d="M4 6h16M4 12h16M4 18h16"
								/>
							</svg>
						</button>
						<h2 className="text-xl font-bold">{getActiveConversationTitle()}</h2>
					</div>
					{activeConversationId && (
						<div className="text-sm text-gray-400">
							ID: {activeConversationId.substring(0, 8)}...
						</div>
					)}
				</div>

				{/* Messages area */}
				<div className="flex-1 p-4 overflow-y-auto bg-gray-900">
					{!activeConversationId ? (
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
								Start a new conversation
							</h3>
							<p className="max-w-md text-gray-400">
								Create a new chat or select an existing one from the sidebar.
							</p>
							<button
								onClick={handleCreateConversation}
								className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
							>
								New Conversation
							</button>
						</div>
					) : messages.length === 0 ? (
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
								Ask me about planning your next trip, finding destinations, or
								creating itineraries. I'm here to help make your travel dreams a
								reality.
							</p>
							<div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
								<button
									onClick={() =>
										setSuggestedInput("Help me plan a trip to Japan")
									}
									className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
								>
									<span className="text-blue-400">→</span> Help me plan a trip to
									Japan
								</button>
								<button
									onClick={() =>
										setSuggestedInput("What are the best beaches in Thailand?")
									}
									className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
								>
									<span className="text-blue-400">→</span> What are the best
									beaches in Thailand?
								</button>
								<button
									onClick={() =>
										setSuggestedInput(
											"I need a 3-day itinerary for New York City"
										)
									}
									className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
								>
									<span className="text-blue-400">→</span> I need a 3-day
									itinerary for NYC
								</button>
								<button
									onClick={() =>
										setSuggestedInput("What's the best time to visit Europe?")
									}
									className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-left"
								>
									<span className="text-blue-400">→</span> Best time to visit
									Europe?
								</button>
							</div>
						</div>
					) : (
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
					)}
				</div>

				{/* Input area */}
				<div className="p-4 bg-gray-800 border-t border-gray-700">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSendMessage();
						}}
						className="flex space-x-2"
					>
						<input
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
							placeholder={
								activeConversationId
									? "Type your message..."
									: "Select or create a conversation..."
							}
							disabled={!connected || !activeConversationId}
						/>
						<button
							type="submit"
							className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-3 font-medium disabled:opacity-50 transition-colors"
							disabled={!connected || !input.trim() || !activeConversationId}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fillRule="evenodd"
									d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
