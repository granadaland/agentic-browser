import { z } from 'zod'

// MCP server configuration schema
export const MCPServerConfigSchema = z.object({
  id: z.string(),  // Server identifier
  name: z.string(),  // Display name
  iconPath: z.string(),  // Path to icon in assets
})

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>

// Available MCP servers
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    iconPath: 'assets/mcp_servers/gmail.svg',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    iconPath: 'assets/mcp_servers/youtube.svg',
  },
  {
    id: 'github',
    name: 'GitHub',
    iconPath: 'assets/mcp_servers/github.svg',
  },
]