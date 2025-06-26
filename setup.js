#!/usr/bin/env node

/**
 * Automated Setup Script for Spotify MCP Server
 * Makes it easy for new users to get started with one command
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🎵 Spotify MCP Server Setup');
  console.log('=============================\n');

  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      console.error('❌ Node.js 18 or higher is required. You have:', nodeVersion);
      console.log('Please install Node.js 18+ from https://nodejs.org/');
      process.exit(1);
    }
    console.log('✅ Node.js version:', nodeVersion);

    // Install dependencies
    console.log('\n📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');

    // Build the project
    console.log('\n🔨 Building project...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Project built successfully');

    // Get Spotify credentials
    console.log('\n🔐 Spotify App Configuration');
    console.log('You need to create a Spotify app first:');
    console.log('1. Go to https://developer.spotify.com/dashboard');
    console.log('2. Click "Create App"');
    console.log('3. Use redirect URI: http://127.0.0.1:8080/callback');
    console.log('4. Copy your Client ID and Client Secret\n');

    const clientId = await question('Enter your Spotify Client ID: ');
    const clientSecret = await question('Enter your Spotify Client Secret: ');

    if (!clientId || !clientSecret) {
      console.error('❌ Client ID and Client Secret are required');
      process.exit(1);
    }

    // Create .env file
    const envContent = `SPOTIFY_CLIENT_ID=${clientId}
SPOTIFY_CLIENT_SECRET=${clientSecret}
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/callback
`;
    writeFileSync('.env', envContent);
    console.log('✅ Environment file created');

    // Configure Claude Desktop
    const claudeConfigPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    const claudeConfigDir = dirname(claudeConfigPath);
    const projectPath = process.cwd();

    // Ensure Claude config directory exists
    if (!existsSync(claudeConfigDir)) {
      mkdirSync(claudeConfigDir, { recursive: true });
    }

    // Read existing config or create new one
    let claudeConfig = { mcpServers: {} };
    if (existsSync(claudeConfigPath)) {
      try {
        claudeConfig = JSON.parse(readFileSync(claudeConfigPath, 'utf8'));
      } catch (error) {
        console.log('⚠️  Existing Claude config has issues, creating new one');
      }
    }

    // Add Spotify server config
    claudeConfig.mcpServers = claudeConfig.mcpServers || {};
    claudeConfig.mcpServers.spotify = {
      command: 'node',
      args: [join(projectPath, 'build', 'index.js')],
      env: {
        SPOTIFY_CLIENT_ID: clientId,
        SPOTIFY_CLIENT_SECRET: clientSecret,
        SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:8080/callback'
      }
    };

    writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
    console.log('✅ Claude Desktop configured');

    // Create test script
    const testScript = `#!/usr/bin/env node
import { spawn } from 'child_process';

console.log('🧪 Testing Spotify MCP Server connection...');

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  console.log('Server log:', data.toString());
});

setTimeout(() => {
  if (output.includes('Starting Spotify MCP Server') || output.includes('"name":"spotify-mcp-server"')) {
    console.log('✅ Server is working correctly!');
  } else {
    console.log('❌ Server may have issues. Check the logs above.');
  }
  server.kill();
  process.exit(0);
}, 3000);

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});
`;

    writeFileSync('test-connection.js', testScript);
    console.log('✅ Test script created');

    // Success message
    console.log('\n🎉 Setup Complete!');
    console.log('==================');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart Claude Desktop completely');
    console.log('2. In Claude, say: "authenticate with spotify"');
    console.log('3. Open the provided URL and authorize');
    console.log('4. Start using: "search for your favorite song"');
    console.log('');
    console.log('Test your setup: npm run test-connection');
    console.log('');
    console.log('Available commands after setup:');
    console.log('  "Search for Bohemian Rhapsody by Queen"');
    console.log('  "Play music" / "Pause" / "Skip to next track"');
    console.log('  "Set volume to 50"');
    console.log('  "Show what\'s currently playing"');
    console.log('  "Add this song to my queue"');
    console.log('');
    console.log('Need help? Check INSTALLATION_GUIDE.md');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\nFor manual setup, see INSTALLATION_GUIDE.md');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();