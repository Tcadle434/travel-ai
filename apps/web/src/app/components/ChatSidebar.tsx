import React from "react";
import { ConversationHistory } from "./types";

interface ChatSidebarProps {
	sidebarOpen: boolean;
	conversationHistory: ConversationHistory[];
	activeConversationId: string | null;
	connected: boolean;
	onCreateConversation: () => void;
	onSwitchConversation: (conversationId: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
	sidebarOpen,
	conversationHistory,
	activeConversationId,
	connected,
	onCreateConversation,
	onSwitchConversation,
}) => {
	return (
		<div
			className={`${
				sidebarOpen ? "w-80" : "w-0 -ml-80"
			} bg-gray-800 transition-all duration-300 ease-in-out overflow-hidden flex flex-col h-full`}
		>
			<div className="p-4 border-b border-gray-700 flex items-center justify-between">
				<h2 className="text-xl font-bold text-blue-400">Conversations</h2>
				<button
					onClick={onCreateConversation}
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
							onClick={() => onSwitchConversation(conv.id)}
						>
							<div className="font-medium text-blue-300">{conv.title}</div>
							<div className="text-sm text-gray-400 truncate">{conv.lastMessage}</div>
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
	);
};

export default ChatSidebar;
