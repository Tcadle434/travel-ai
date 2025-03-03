export interface Message {
	id: string;
	content: string;
	isUser: boolean;
	timestamp: Date;
	metadata?: {
		isChunk?: boolean;
		chunkIndex?: number;
		totalChunks?: number;
		[key: string]: any;
	};
}
