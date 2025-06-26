#!/usr/bin/env node

/**
 * Release Package Creator for Spotify MCP Server
 * Creates a distribution-ready package for easy user deployment
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const VERSION = '1.0.0';
const RELEASE_DIR = `spotify-mcp-server-v${VERSION}`;

async function createRelease() {
  console.log(`🚀 Creating Spotify MCP Server Release v${VERSION}`);
  console.log('================================================\n');

  try {
    // Clean and build
    console.log('🧹 Cleaning previous builds...');
    execSync('npm run clean', { stdio: 'inherit' });

    console.log('🔨 Building project...');
    execSync('npm run build:production', { stdio: 'inherit' });

    // Create release directory
    console.log(`📦 Creating release package: ${RELEASE_DIR}`);
    if (existsSync(RELEASE_DIR)) {
      execSync(`rm -rf ${RELEASE_DIR}`);
    }
    mkdirSync(RELEASE_DIR, { recursive: true });

    // Copy essential files
    const filesToCopy = [
      'README.md',
      'INSTALLATION_GUIDE.md',
      'package.json',
      'package-lock.json',
      'setup.js',
      '.env.example',
      'LICENSE'
    ];

    console.log('📄 Copying essential files...');
    filesToCopy.forEach(file => {
      if (existsSync(file)) {
        copyFileSync(file, join(RELEASE_DIR, file));
        console.log(`  ✅ ${file}`);
      }
    });

    // Copy build directory
    console.log('📁 Copying build directory...');
    execSync(`cp -r build ${RELEASE_DIR}/build`);

    // Copy docs directory
    console.log('📚 Copying documentation...');
    execSync(`cp -r docs ${RELEASE_DIR}/docs`);

    // Create simplified package.json for distribution
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const distPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: packageJson.main,
      type: packageJson.type,
      scripts: {
        setup: 'node setup.js',
        start: 'node build/index.js',
        'test-connection': 'node test-connection.js'
      },
      keywords: packageJson.keywords,
      author: packageJson.author,
      license: packageJson.license,
      engines: packageJson.engines,
      dependencies: packageJson.dependencies
    };

    writeFileSync(
      join(RELEASE_DIR, 'package.json'),
      JSON.stringify(distPackageJson, null, 2)
    );

    // Create quick start script
    const quickStartScript = `#!/bin/bash
echo "🎵 Spotify MCP Server Quick Start"
echo "================================="
echo ""
echo "This script will set up the Spotify MCP Server for Claude Desktop"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18 or higher is required. You have: $(node -v)"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies and run setup
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔧 Running setup script..."
npm run setup

echo ""
echo "🎉 Setup complete!"
echo "Next steps:"
echo "1. Restart Claude Desktop"
echo "2. Say 'authenticate with spotify' in Claude"
echo "3. Start using: 'search for your favorite song'"
`;

    writeFileSync(join(RELEASE_DIR, 'quick-start.sh'), quickStartScript);
    execSync(`chmod +x ${RELEASE_DIR}/quick-start.sh`);

    // Create Windows batch file
    const windowsScript = `@echo off
echo 🎵 Spotify MCP Server Quick Start
echo =================================
echo.
echo This script will set up the Spotify MCP Server for Claude Desktop
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js version:
node -v
echo.

echo 📦 Installing dependencies...
npm install

echo.
echo 🔧 Running setup script...
npm run setup

echo.
echo 🎉 Setup complete!
echo Next steps:
echo 1. Restart Claude Desktop
echo 2. Say 'authenticate with spotify' in Claude
echo 3. Start using: 'search for your favorite song'
pause
`;

    writeFileSync(join(RELEASE_DIR, 'quick-start.bat'), windowsScript);

    // Create archive
    console.log('📁 Creating release archive...');
    execSync(`tar -czf ${RELEASE_DIR}.tar.gz ${RELEASE_DIR}`);
    execSync(`zip -r ${RELEASE_DIR}.zip ${RELEASE_DIR}`);

    // Generate checksums
    console.log('🔐 Generating checksums...');
    const tarHash = execSync(`shasum -a 256 ${RELEASE_DIR}.tar.gz`).toString().trim();
    const zipHash = execSync(`shasum -a 256 ${RELEASE_DIR}.zip`).toString().trim();

    const checksums = `# Spotify MCP Server v${VERSION} - Checksums

## Files
- ${RELEASE_DIR}.tar.gz
- ${RELEASE_DIR}.zip

## SHA256 Checksums
${tarHash}
${zipHash}

## Verification
\`\`\`bash
# Verify tar.gz
shasum -a 256 -c <<< "${tarHash}"

# Verify zip
shasum -a 256 -c <<< "${zipHash}"
\`\`\`
`;

    writeFileSync('CHECKSUMS.md', checksums);

    // Create release notes
    const releaseNotes = `# Spotify MCP Server v${VERSION} Release Notes

## 🎉 What's New

### ✨ Features
- **One-Command Setup**: \`npm run setup\` handles everything automatically
- **21 Spotify Tools**: Complete music control through natural language
- **Secure Authentication**: OAuth 2.0 + PKCE with encrypted token storage
- **Multi-Device Support**: Control any Spotify-connected device
- **Smart Parameter Handling**: Flexible string-to-type conversion
- **Enterprise Security**: HSM support, certificate pinning, audit logging

### 🔧 Improvements
- **Easy Installation**: Automated setup script guides users through Spotify app creation
- **Better Error Handling**: Comprehensive error messages and troubleshooting
- **Enhanced Documentation**: Step-by-step guides for all skill levels
- **Cross-Platform**: Works on macOS, Linux, and Windows

### 🛡️ Security
- **Production Ready**: Secure by default with configurable security features
- **Token Encryption**: AES-256 + PBKDF2 for local token storage
- **Rate Limiting**: Automatic rate limiting and retry logic
- **CSRF Protection**: State parameter validation

## 📦 Installation

### Quick Start (Recommended)
\`\`\`bash
# Download and extract
tar -xzf ${RELEASE_DIR}.tar.gz
cd ${RELEASE_DIR}

# Run setup (macOS/Linux)
./quick-start.sh

# Or run setup (Windows)
quick-start.bat
\`\`\`

### Manual Installation
See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for detailed instructions.

## 🎯 Usage Examples

Once set up, use natural language with Claude:

- **"Search for Marianas Trench by August Burns Red"**
- **"Play music"** / **"Pause"** / **"Skip to next track"**
- **"Set volume to 50"**
- **"Add this song to my queue"**
- **"Show what's currently playing"**
- **"List my available devices"**

## 🔧 Requirements

- **Node.js** 18 or higher
- **Claude Desktop** application
- **Spotify Account** (Free or Premium)
- **Internet Connection** for API access

## 🆘 Support

- 🐛 [Report Issues](https://github.com/your-username/spotify-mcp-server/issues)
- 💬 [Join Discussions](https://github.com/your-username/spotify-mcp-server/discussions)
- 📖 [Documentation](./docs/)

---

**Enjoy controlling Spotify with Claude! 🎶**
`;

    writeFileSync('RELEASE_NOTES.md', releaseNotes);

    console.log('\n🎉 Release Creation Complete!');
    console.log('=============================');
    console.log('');
    console.log('📦 Created packages:');
    console.log(`  - ${RELEASE_DIR}.tar.gz`);
    console.log(`  - ${RELEASE_DIR}.zip`);
    console.log('');
    console.log('📄 Documentation:');
    console.log('  - RELEASE_NOTES.md');
    console.log('  - CHECKSUMS.md');
    console.log('');
    console.log('🚀 Ready for distribution!');

  } catch (error) {
    console.error('❌ Release creation failed:', error.message);
    process.exit(1);
  }
}

createRelease();