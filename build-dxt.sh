#!/bin/bash

# Spotify MCP Server - DXT Build Script
# 
# This script builds the DXT package and moves it to the parent directory

set -e  # Exit on any error

echo "🚀 Building Spotify MCP Server DXT package..."

# Determine script location and set proper paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If running from spotify-mcp-dxt subdirectory, adjust paths
if [[ "$(basename "$PWD")" == "spotify-mcp-dxt" ]]; then
    PROJECT_DIR="$PWD/.."
    DXT_DIR="$PWD"
else
    PROJECT_DIR="$PWD"
    DXT_DIR="$PWD/spotify-mcp-dxt"
fi

echo "📂 Project directory: $PROJECT_DIR"
echo "📂 DXT directory: $DXT_DIR"

# Build from project directory
echo "📦 Building project..."
cd "$PROJECT_DIR"
npm run build

# Copy latest build to DXT server directory
echo "📋 Copying latest build to DXT package..."
cp -r build/* "$DXT_DIR/server/"

# Pack the DXT from DXT directory
echo "🔧 Packing DXT..."
cd "$DXT_DIR"
npx dxt pack

# Move the resulting .dxt file to parent directory
echo "📁 Moving DXT file to parent directory..."
mv *.dxt ../spotify-mcp-server.dxt

echo "✅ DXT package built and moved successfully!"
echo "📍 Location: $(ls -la ../spotify-mcp-server.dxt)"