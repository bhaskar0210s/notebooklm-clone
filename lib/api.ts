// lib/api.ts
// Example server-side data fetching function

interface FetchDataResponse {
  message: string;
  timestamp: string;
  items: Array<{
    id: number;
    name: string;
  }>;
}

export async function fetchData(): Promise<FetchDataResponse> {
  // Simulate an API call or database query
  // This runs only on the server

  // In a real app, you might fetch from:
  // - A database
  // - An external API
  // - A CMS
  // - etc.

  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay

  return {
    message: "This data was fetched on the server!",
    timestamp: new Date().toISOString(),
    items: [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" },
    ],
  };
}
