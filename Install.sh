#!/bin/bash

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 12 or above."
    exit 1
fi

# Extract the version number and compare it
NODE_VERSION=$(node -v | grep -oE '[0-9]+')
if [ "$NODE_VERSION" -lt 12 ]; then
    echo "Node.js version is less than 12. Please upgrade Node.js to version 12 or above."
    exit 1
fi

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Checking for installation capabilities..."

    if ! command -v apt-get &> /dev/null; then
        echo "apt-get is not available on this system. Cannot install Git automatically. Please install Git manually."
        exit 1
    else
        # Check if sudo is available
        if ! command -v sudo &> /dev/null; then
            echo "sudo is not available. Try to install Git.."
            echo "Installing Git..."
            apt-get update && apt-get install git -y

            if [ $? -ne 0 ]; then
                echo "Failed to install Git. Please install Git manually."
                exit 1
            else
                echo "Git successfully installed."
            fi
        else
            echo "Installing Git..."
            sudo apt-get update && sudo apt-get install git -y

            if [ $? -ne 0 ]; then
                echo "Failed to install Git. Please install Git manually."
                exit 1
            else
                echo "Git successfully installed."
            fi
        fi
    fi
fi

# Initialize variables
INSTALLATION_PATH="."
CLIENT_ID=""

# Parse command line options
while getopts ":p:i:" opt; do
  case $opt in
    p)
      INSTALLATION_PATH=$OPTARG
      ;;
    i)
      CLIENT_ID=$OPTARG
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

# Check if CLIENT_ID was provided
if [ -z "$CLIENT_ID" ]; then
    echo "Usage: $0 -i <client_id> [-p <installation_path>]"
    exit 1
fi

CTUNNEL_PATH="$INSTALLATION_PATH"

# Clone your repo - ensure the client has access
git clone https://github.com/LMJayasundara/cTunnel.git
cd cTunnel

# Install NPM dependencies
if command -v sudo &> /dev/null; then
    sudo npm install
else
    npm install
fi

# Replace the client ID in your code - adjust this command based on where the ID needs to be inserted
sed -i "s/const username = .*/const username = \"$CLIENT_ID\";/" client.js

# Create the installation directory and move the modified project there
mkdir -p "$CTUNNEL_PATH"
cp -R ./* "$CTUNNEL_PATH"

# Install pm2 globally
if command -v sudo &> /dev/null; then
    sudo npm install pm2@latest -g
else
    npm install pm2@latest -g
fi

if command -v sudo &> /dev/null; then
    # Use pm2 to start your script and save this setup for startup
    sudo pm2 start $CTUNNEL_PATH/client.js --name cTunnelClient
else
    pm2 start $CTUNNEL_PATH/client.js --name cTunnelClient
fi

# Generate and configure pm2 startup script
if command -v sudo &> /dev/null; then
    sudo pm2 startup
    sudo pm2 save
else
    pm2 startup
    pm2 save
fi

echo "Installation complete. Your client ID is: $CLIENT_ID"
echo "Project installed in: $CTUNNEL_PATH"
