import React, { useState } from "react";

interface MessageInputProps {
	connected: boolean;
	activeConversationId: string | null;
	onSendMessage: (message: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
	connected,
	activeConversationId,
	onSendMessage,
}) => {
	const [input, setInput] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!connected || !input.trim() || !activeConversationId) return;

		onSendMessage(input);
		setInput("");
	};

	return (
		<div className="p-4 bg-gray-800 border-t border-gray-700">
			<form onSubmit={handleSubmit} className="flex space-x-2">
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
	);
};

export default MessageInput;
