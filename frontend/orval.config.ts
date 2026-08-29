import { defineConfig } from "orval";

/**
 * Requires the NestJS backend to be running:
 *   http://localhost:3001/api/openapi.json
 */
export default defineConfig({
  naala: {
    input: {
      target: "http://localhost:3001/api/openapi.json",
    },
    output: {
      target: "./src/generated/api/naala.ts",
      schemas: "./src/generated/api/model",
      client: "react-query",
      httpClient: "fetch",
      mode: "split",
      mock: false,
      override: {
        mutator: {
          path: "./src/lib/api/fetcher.ts",
          name: "customFetcher",
        },
      },
    },
  },
});
