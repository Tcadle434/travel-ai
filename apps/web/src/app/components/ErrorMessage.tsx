import React from "react";

interface ErrorMessageProps {
	message: string | null;
	onDismiss: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss }) => {
	if (!message) return null;

	return (
		<div className="bg-red-500 text-white p-3 rounded-md mb-4 flex justify-between items-center">
			<span>{message}</span>
			<button onClick={onDismiss} className="ml-3 text-white hover:text-gray-200">
				✕
			</button>
		</div>
	);
};

export default ErrorMessage;
