import React from "react";

interface ChatHeaderProps {
	title: string;
	conversationId: string | null;
	onToggleSidebar: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ title, conversationId, onToggleSidebar }) => {
	return (
		<div className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
			<div className="flex items-center">
				<button
					onClick={onToggleSidebar}
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
				<h2 className="text-xl font-bold">{title}</h2>
			</div>
			{conversationId && (
				<div className="text-sm text-gray-400">ID: {conversationId.substring(0, 8)}...</div>
			)}
		</div>
	);
};

export default ChatHeader;
