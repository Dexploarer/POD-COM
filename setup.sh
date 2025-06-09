#!/bin/bash

# POD-COM Development Setup Script
# This script sets up the development environment for POD-COM

set -e

echo "🚀 Setting up POD-COM development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js found: $NODE_VERSION"
else
    print_error "Node.js is required. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Rust
if command_exists rustc; then
    RUST_VERSION=$(rustc --version)
    print_success "Rust found: $RUST_VERSION"
else
    print_error "Rust is required. Please install from https://rustup.rs/"
    exit 1
fi

# Check Solana CLI
if command_exists solana; then
    SOLANA_VERSION=$(solana --version)
    print_success "Solana CLI found: $SOLANA_VERSION"
else
    print_error "Solana CLI is required. Please install from https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Check Anchor
if command_exists anchor; then
    ANCHOR_VERSION=$(anchor --version)
    print_success "Anchor found: $ANCHOR_VERSION"
else
    print_warning "Anchor not found. Installing..."
    cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
    print_success "Anchor installed"
fi

# Check Yarn
if command_exists yarn; then
    YARN_VERSION=$(yarn --version)
    print_success "Yarn found: $YARN_VERSION"
else
    print_step "Installing Yarn..."
    npm install -g yarn
    print_success "Yarn installed"
fi

# Setup Solana configuration
print_step "Setting up Solana configuration..."

# Check if wallet exists
WALLET_PATH="$HOME/.config/solana/id.json"
if [ ! -f "$WALLET_PATH" ]; then
    print_step "Creating new Solana wallet..."
    solana-keygen new --outfile "$WALLET_PATH" --no-bip39-passphrase
    print_success "Wallet created at $WALLET_PATH"
else
    print_success "Wallet already exists at $WALLET_PATH"
fi

# Set to devnet
print_step "Configuring Solana for devnet..."
solana config set --url devnet
solana config set --keypair "$WALLET_PATH"

# Get wallet address
WALLET_ADDRESS=$(solana address)
print_success "Wallet address: $WALLET_ADDRESS"

# Request airdrop
print_step "Requesting devnet airdrop..."
solana airdrop 2 || print_warning "Airdrop failed - you may need to request manually"

# Check balance
BALANCE=$(solana balance)
print_success "Current balance: $BALANCE"

# Install dependencies
print_step "Installing dependencies..."
yarn install

# Build the program
print_step "Building Anchor program..."
anchor build

# Generate program keypair if it doesn't exist
PROGRAM_KEYPAIR="target/deploy/pod_com-keypair.json"
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    print_step "Generating program keypair..."
    solana-keygen new --outfile "$PROGRAM_KEYPAIR" --no-bip39-passphrase
fi

# Get program ID
PROGRAM_ID=$(solana address -k "$PROGRAM_KEYPAIR")
print_success "Program ID: $PROGRAM_ID"

# Update Anchor.toml with actual program ID
print_step "Updating Anchor.toml..."
sed -i.bak "s/PodC1111111111111111111111111111111111111111/$PROGRAM_ID/g" Anchor.toml
rm Anchor.toml.bak

# Update lib.rs with actual program ID
print_step "Updating program declare_id..."
sed -i.bak "s/PodC1111111111111111111111111111111111111111/$PROGRAM_ID/g" programs/pod-com/src/lib.rs
rm programs/pod-com/src/lib.rs.bak

# Rebuild with correct program ID
print_step "Rebuilding with correct program ID..."
anchor build

# Deploy to devnet
print_step "Deploying to devnet..."
anchor deploy --provider.cluster devnet

# Run tests
print_step "Running tests..."
anchor test --skip-deploy

# Setup CLI
print_step "Building CLI..."
cd cli
yarn install
yarn build
cd ..

# Create environment file
print_step "Creating environment configuration..."
cp .env.example .env
sed -i.bak "s/PodC1111111111111111111111111111111111111111/$PROGRAM_ID/g" .env
rm .env.bak

# Setup CLI link
print_step "Setting up CLI..."
cd cli
npm link
cd ..

print_success "CLI linked! You can now use 'pod' command globally"

# Final instructions
echo ""
echo "🎉 POD-COM development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Initialize CLI: pod init"
echo "2. Register an agent: pod register"
echo "3. Create a channel: pod channel create"
echo "4. Send a message: pod send <channel-id> \"Hello POD-COM!\""
echo ""
echo "📖 Documentation: ./README.md"
echo "🧪 Run tests: anchor test"
echo "🔨 Build: anchor build"
echo "📦 Deploy: anchor deploy --provider.cluster devnet"
echo ""
echo "💰 Your wallet address: $WALLET_ADDRESS"
echo "🆔 Program ID: $PROGRAM_ID"
echo "💳 Current balance: $BALANCE"
echo ""
print_success "Happy building! 🚀"
