# Travel AI App

An AI-powered travel planning application that helps users plan their trips with personalized itineraries.

## Features

### Multiple Itinerary Generation

- The app now generates three distinct travel itineraries based on user preferences
- Each itinerary includes detailed information about destinations, activities, accommodations, transportation, and budget
- Itineraries are displayed on a dedicated page for easy comparison

### Automatic Travel Request Detection

- The app now automatically detects when a user is asking about travel planning
- No need to explicitly request itineraries - simply ask about travel destinations or trip planning
- The system will recognize travel-related queries and generate appropriate itineraries

### Message Chunking System

- Large AI responses are automatically split into manageable chunks
- Chunks are sent sequentially to ensure complete delivery of long itineraries
- Prevents message truncation issues with detailed travel plans

### Improved Itinerary Parsing

- Enhanced parser handles various itinerary formats including markdown headings
- Extracts key information like highlights, budget, accommodations, and transportation
- Organizes content for better readability and comparison

## Recent Fixes

### Socket Connection Improvements

- Fixed issue with conversation creation by establishing socket connection immediately
- Added proper error handling for socket connection failures
- Improved logging for better debugging of connection issues

### Websocket Event Handlers

- Added missing handlers for create_conversation and join_conversation events
- Enhanced error handling in websocket communication
- Fixed metadata handling for chunked messages

### Type Definitions

- Updated Message type to include metadata for chunked messages
- Fixed type imports to use the correct definitions
- Added null checks to prevent errors with optional properties

## Implementation Details

### Automatic Travel Detection

The system uses natural language processing to identify travel-related queries by:

1. Checking for travel-related keywords (e.g., "travel", "vacation", "hotel")
2. Identifying question patterns about travel destinations
3. Detecting location mentions in user messages

When a travel request is detected, the system automatically enhances the prompt to generate three distinct itineraries in a structured format.

### Itinerary Format

Each itinerary follows a consistent structure with sections for:

- Overview
- Daily Schedule
- Accommodations
- Transportation
- Estimated Budget
- Highlights

### Message Chunking

For large itinerary responses:

1. The system detects when a message exceeds the size threshold (8000 characters)
2. It splits the message into logical chunks at appropriate boundaries
3. Chunks are sent sequentially with metadata
4. A complete message notification is sent after all chunks are delivered

## Troubleshooting

### Itinerary Not Displaying

- Check if your query was specific enough to be recognized as a travel request
- Try including more travel-related keywords or destination names
- Ensure you're asking about planning a trip rather than general travel information

### Incomplete Itineraries

- Very complex or detailed requests may still result in truncated responses
- Try simplifying your request or focusing on specific aspects of your trip
- If you receive a notification about itineraries but don't see them, try refreshing the page

### Message Chunking Issues

- If you notice messages being cut off, the chunking system may need adjustment
- Check the browser console for any errors related to message processing
- Clear your browser cache and localStorage if you encounter persistent issues

### Connection Issues

- If you can't create a new conversation, check the browser console for connection errors
- Try refreshing the page to re-establish the socket connection
- Ensure the backend server is running and accessible

# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo
pnpm dev
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
npx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Configuration Options](https://turbo.build/repo/docs/reference/configuration)
- [CLI Usage](https://turbo.build/repo/docs/reference/command-line-reference)
