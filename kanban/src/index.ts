import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { KanClient } from "./client.js";
import { registerWorkspacesTool } from "./tools/workspaces.js";
import { registerBoardsTool } from "./tools/boards.js";
import { registerListsTool } from "./tools/lists.js";
import { registerCardsTool } from "./tools/cards.js";
import { registerLabelsTool } from "./tools/labels.js";
import { registerCardActionsTool } from "./tools/card-actions.js";

const apiKey = process.env.KAN_API_KEY;
if (!apiKey) {
  console.error("Error: KAN_API_KEY environment variable is required.");
  console.error("Generate a key at https://kan.bn → Account Settings, then set KAN_API_KEY=kan_...");
  process.exit(1);
}

const client = new KanClient(apiKey);
const server = new McpServer({ name: "kan", version: "1.0.0" });

registerWorkspacesTool(server, client);
registerBoardsTool(server, client);
registerListsTool(server, client);
registerCardsTool(server, client);
registerLabelsTool(server, client);
registerCardActionsTool(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
