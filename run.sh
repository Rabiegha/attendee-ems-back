#!/bin/bash

# Load NVM and use the correct Node.js version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use the LTS version of Node.js
nvm use --lts

# Run the command passed as argument
exec "$@"
