import { z } from 'zod'

// MCP server configuration schema
export const MCPServerConfigSchema = z.object({
  id: z.string(),  // Server identifier
  name: z.string(),  // Display name
  subdomain: z.string(),  // Server subdomain for URL construction
  iconPath: z.string(),  // Path to icon in assets
})

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>

// Available MCP servers - names must match Klavis API exactly
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    subdomain: 'gmail',
    iconPath: 'assets/mcp_servers/gmail.svg',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    subdomain: 'youtube',
    iconPath: 'assets/mcp_servers/youtube.svg',
  },
  {
    id: 'github',
    name: 'GitHub',
    subdomain: 'github',
    iconPath: 'assets/mcp_servers/github.svg',
  },
  {
    id: 'slack',
    name: 'Slack',
    subdomain: 'slack',
    iconPath: 'assets/mcp_servers/slack.svg',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    subdomain: 'gcalendar',
    iconPath: 'assets/mcp_servers/google-calendar.svg',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    subdomain: 'gdrive',
    iconPath: 'assets/mcp_servers/google-drive.svg',
  },
  {
    id: 'notion',
    name: 'Notion',
    subdomain: 'notion',
    iconPath: 'assets/mcp_servers/notion.svg',
  },
  {
    id: 'linear',
    name: 'Linear',
    subdomain: 'linear',
    iconPath: 'assets/mcp_servers/linear.svg',
  },
]