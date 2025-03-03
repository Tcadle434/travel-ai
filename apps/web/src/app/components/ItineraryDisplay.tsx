"use client";

import { useState } from "react";
import { ItineraryData, ItineraryOption } from "./types";

interface ItineraryDisplayProps {
	itineraryData: ItineraryData;
	onBackToChat: () => void;
	onEditItinerary: (feedback: string) => void;
}

export default function ItineraryDisplay({
	itineraryData,
	onBackToChat,
	onEditItinerary,
}: ItineraryDisplayProps) {
	const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
	const [feedbackInput, setFeedbackInput] = useState("");
	const [expandedDays, setExpandedDays] = useState<number[]>([0]); // Start with first day expanded

	const { options } = itineraryData.options;
	const { destination, duration, travelers } = itineraryData.options;
	const selectedOption = options[selectedOptionIndex];

	const toggleDayExpand = (dayIndex: number) => {
		if (expandedDays.includes(dayIndex)) {
			setExpandedDays(expandedDays.filter((day) => day !== dayIndex));
		} else {
			setExpandedDays([...expandedDays, dayIndex]);
		}
	};

	const handleSubmitFeedback = () => {
		if (feedbackInput.trim()) {
			onEditItinerary(feedbackInput);
			setFeedbackInput("");
		}
	};

	// Generate a gradient color based on the option index
	const getOptionGradient = (index: number) => {
		const gradients = [
			"from-blue-500 to-blue-600",
			"from-emerald-500 to-emerald-600",
			"from-amber-500 to-amber-600",
		];
		return gradients[index % gradients.length];
	};

	return (
		<div className="flex flex-col h-full bg-white text-gray-800">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 p-5 flex justify-between items-center shadow-sm">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-gray-900">
						Your Travel Itineraries
					</h1>
					<p className="text-gray-600 font-medium mt-1">
						<span className="inline-flex items-center mr-3">
							<span className="mr-1">📍</span> {destination}
						</span>
						<span className="inline-flex items-center mr-3">
							<span className="mr-1">📅</span> {duration}
						</span>
						<span className="inline-flex items-center">
							<span className="mr-1">👥</span> {travelers}
						</span>
					</p>
				</div>
				<button
					onClick={onBackToChat}
					className="px-5 py-2.5 bg-blue-500 rounded-lg hover:bg-blue-600 transition shadow-sm text-white flex items-center font-medium"
				>
					<svg
						className="w-4 h-4 mr-2"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						/>
					</svg>
					Back to Chat
				</button>
			</div>

			{/* Main content */}
			<div className="flex flex-1 overflow-hidden">
				{/* Itinerary options sidebar */}
				<div className="w-1/4 bg-gray-50 border-r border-gray-200 p-5 overflow-y-auto">
					<h2 className="text-xl font-semibold mb-4 text-gray-800">
						Choose Your Adventure
					</h2>
					<div className="space-y-4">
						{options.map((option, index) => (
							<div
								key={index}
								onClick={() => setSelectedOptionIndex(index)}
								className={`p-4 rounded-lg cursor-pointer transition border transform hover:-translate-y-1 duration-200 ${
									selectedOptionIndex === index
										? `bg-gradient-to-br ${getOptionGradient(index)} border-blue-400 shadow-md text-white`
										: "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
								}`}
							>
								<h3 className="font-medium text-lg">{option.title}</h3>
								{option.estimatedCost && (
									<div className="flex items-center mt-2 text-sm">
										<span
											className={`${selectedOptionIndex === index ? "text-white" : "text-green-600"} font-bold`}
										>
											{option.estimatedCost.amount}{" "}
											{option.estimatedCost.currency}
										</span>
										<span
											className={`ml-2 ${selectedOptionIndex === index ? "text-blue-100" : "text-gray-500"}`}
										>
											estimated
										</span>
									</div>
								)}
								<div className="mt-2 flex flex-wrap gap-2">
									{option.highlights.slice(0, 2).map((highlight, i) => (
										<span
											key={i}
											className={`text-xs px-2 py-1 rounded-full ${
												selectedOptionIndex === index
													? "bg-blue-400 text-white"
													: "bg-gray-100 text-gray-700"
											}`}
										>
											{highlight}
										</span>
									))}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Selected itinerary details */}
				<div className="flex-1 p-6 overflow-y-auto bg-white">
					<div className="max-w-4xl mx-auto">
						<div
							className={`bg-gradient-to-r ${getOptionGradient(selectedOptionIndex)} p-6 rounded-xl shadow-md mb-8 text-white`}
						>
							<h2 className="text-2xl font-bold mb-2">{selectedOption.title}</h2>
							<p className="text-white mb-4">{selectedOption.description}</p>

							{/* Highlights */}
							<div className="flex flex-wrap gap-2 mt-4">
								{selectedOption.highlights.map((highlight, index) => (
									<div
										key={index}
										className="bg-white bg-opacity-20 backdrop-filter backdrop-blur-sm px-3 py-1.5 rounded-full text-sm"
									>
										<span className="text-white">✦ {highlight}</span>
									</div>
								))}
							</div>
						</div>

						{/* Day-by-day itinerary */}
						<div className="mb-8">
							<h3 className="text-xl font-semibold mb-4 flex items-center text-gray-800">
								<svg
									className="w-5 h-5 mr-2 text-blue-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								Your Daily Itinerary
							</h3>
							<div className="space-y-4">
								{selectedOption.days.map((day, dayIndex) => (
									<div
										key={dayIndex}
										className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm transition"
									>
										<div
											className={`p-4 flex justify-between items-center cursor-pointer ${expandedDays.includes(dayIndex) ? "bg-gray-50" : "hover:bg-gray-50"}`}
											onClick={() => toggleDayExpand(dayIndex)}
										>
											<h4 className="font-semibold flex items-center text-gray-800">
												<span
													className={`bg-gradient-to-r ${getOptionGradient(selectedOptionIndex)} text-white rounded-full w-7 h-7 flex items-center justify-center mr-3`}
												>
													{day.day}
												</span>
												{day.title}
											</h4>
											<span className="text-gray-400">
												{expandedDays.includes(dayIndex) ? (
													<svg
														className="w-5 h-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M5 15l7-7 7 7"
														/>
													</svg>
												) : (
													<svg
														className="w-5 h-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M19 9l-7 7-7-7"
														/>
													</svg>
												)}
											</span>
										</div>

										{expandedDays.includes(dayIndex) && (
											<div className="p-4 space-y-6 bg-white divide-y divide-gray-100">
												{day.activities.map((activity, actIndex) => (
													<div
														key={actIndex}
														className={`${actIndex > 0 ? "pt-4" : ""} ${actIndex === 0 ? "" : "mt-2"}`}
													>
														<div className="flex items-start">
															{activity.time && (
																<span className="text-blue-600 font-medium mr-3 bg-blue-50 px-2 py-1 rounded text-sm whitespace-nowrap">
																	{activity.time}
																</span>
															)}
															<div className="flex-1">
																<span className="font-medium text-lg text-gray-800">
																	{activity.activity}
																</span>
																<p className="text-gray-600 mt-1">
																	{activity.description}
																</p>
																{activity.location && (
																	<div className="flex items-center mt-2 text-sm text-gray-500">
																		<svg
																			className="w-4 h-4 mr-1"
																			fill="none"
																			stroke="currentColor"
																			viewBox="0 0 24 24"
																			xmlns="http://www.w3.org/2000/svg"
																		>
																			<path
																				strokeLinecap="round"
																				strokeLinejoin="round"
																				strokeWidth={2}
																				d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
																			/>
																			<path
																				strokeLinecap="round"
																				strokeLinejoin="round"
																				strokeWidth={2}
																				d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
																			/>
																		</svg>
																		{activity.location}
																	</div>
																)}
															</div>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								))}
							</div>
						</div>

						{/* Feedback section */}
						<div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
							<h3 className="text-lg font-semibold mb-3 text-gray-800">
								Need adjustments?
							</h3>
							<div className="flex">
								<textarea
									value={feedbackInput}
									onChange={(e) => setFeedbackInput(e.target.value)}
									placeholder="Tell us what you'd like to change about this itinerary..."
									className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
									rows={2}
								/>
								<button
									onClick={handleSubmitFeedback}
									disabled={!feedbackInput.trim()}
									className={`px-4 rounded-r-lg flex items-center justify-center ${
										feedbackInput.trim()
											? "bg-blue-500 hover:bg-blue-600 text-white"
											: "bg-gray-200 text-gray-500 cursor-not-allowed"
									}`}
								>
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
										/>
									</svg>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
