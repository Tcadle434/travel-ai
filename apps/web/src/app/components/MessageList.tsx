import React, { useRef, useEffect } from "react";
import { Message } from "./types";

interface MessageListProps {
	messages: Message[];
	typing: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, typing }) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

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
