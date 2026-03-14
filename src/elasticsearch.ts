import { Client } from "@opensearch-project/opensearch";

export function createElasticsearchClient(): Client {
  const node = process.env.ELASTICSEARCH_URL;
  const apiKey = process.env.ELASTICSEARCH_API_KEY;

  if (!node) {
    throw new Error("ELASTICSEARCH_URL environment variable is not set");
  }

  const clientOptions: Record<string, unknown> = { node };

  if (apiKey) {
    clientOptions.auth = { apiKey };
  }

  if (process.env.ELASTICSEARCH_TLS_SKIP_VERIFY === "true") {
    clientOptions.ssl = { rejectUnauthorized: false };
  }

  return new Client(clientOptions);
}
