# moons-app

moons-app is a front end for [Moons Protocol](https://github.com/JoelAlexander/moons-contracts), a resource sharing protocol for impact networks.

## Getting Started

Follow these instructions to set up and run the project on your local machine.

### Prerequisites

Ensure you have the following installed:

- [Bun](https://bun.sh) (Bun is a JavaScript toolkit with a bundler, test runner, and Node-compatible package manager)

### Installation

1. **Set Up Bun**

   If Bun is not installed, run the following command to install it:

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

   After installation, make sure to enable Bun by sourcing your shell configuration:

   ```bash
   source /home/joel/.bashrc
   ```

2. **Configure Environment Variables**

   Create a `.env.local` file and set up the required RPC URL for BASE:

   ```bash
   echo "VITE_BASE_NODE=https://your-rpc-url.com" > .env.local
   ```

   Replace `https://your-rpc-url.com` with your actual RPC URL.

3. **Install Dependencies and Run Development Server**

   Navigate to the project directory and execute the following command:

   ```bash
   bun install && bun run dev
   ```

4. **Access the Application**

   Open your web browser and go to [http://localhost:5173/](http://localhost:5173/) to access the site.

## Additional Resources

moons-app is publicly available at [https://www.moons-protocol.xyz](https://www.moons-protocol.xyz).
