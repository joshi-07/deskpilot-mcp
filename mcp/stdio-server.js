#!/usr/bin/env node
/**
 * DeskPilot MCP - Standard STDIO Model Context Protocol (MCP) Server
 * Compatible with Claude Desktop, Cursor, and any MCP Client.
 */

import readline from 'readline';
import { MCP_TOOLS, executeTool } from './tools.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id, result, error = null) {
  const response = {
    jsonrpc: '2.0',
    id
  };
  if (error) {
    response.error = {
      code: error.code || -32603,
      message: error.message || 'Internal error'
    };
  } else {
    response.result = result;
  }
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const message = JSON.parse(line);
    const { id, method, params } = message;

    switch (method) {
      case 'initialize': {
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'deskpilot-mcp',
            version: '1.0.0'
          },
          capabilities: {
            tools: {}
          }
        });
        break;
      }

      case 'notifications/initialized': {
        // Handshake complete
        break;
      }

      case 'tools/list': {
        sendResponse(id, {
          tools: MCP_TOOLS
        });
        break;
      }

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        try {
          const data = await executeTool(name, args);
          sendResponse(id, {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data, null, 2)
              }
            ],
            isError: false
          });
        } catch (toolErr) {
          sendResponse(id, {
            content: [
              {
                type: 'text',
                text: `Tool Execution Error: ${toolErr.message}`
              }
            ],
            isError: true
          });
        }
        break;
      }

      case 'ping': {
        sendResponse(id, {});
        break;
      }

      default: {
        sendResponse(id, null, {
          code: -32601,
          message: `Method not supported: ${method}`
        });
      }
    }
  } catch (err) {
    sendResponse(null, null, {
      code: -32700,
      message: `Parse error: ${err.message}`
    });
  }
});
