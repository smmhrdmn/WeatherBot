# Discord Weather Bot

A Discord bot that allows users to check weather for multiple locations from a Discord channel. Displays weather information in a clean, visually organized format.

## Features

- Both slash commands and text commands supported
- Check weather for specific locations using `/weather [location]` or `!weather <location>`
- Save multiple locations to check regularly
- Retrieve weather for all saved locations with `/weather` or `!weather`
- Add new locations with `/addlocation <location>` or `!addlocation <location>`
- Remove locations with `/removelocation <location>` or `!removelocation <location>`
- List all saved locations with `/listlocations` or `!listlocations`
- Get 5-day weather forecast with `/forecast <location>` or `!forecast <location>`
- Get help with `/weatherhelp` or `!help`

## Visual Features

- Clean, modern Discord embed format
- Intuitive field-based information layout
- Emoji-based weather indicators
- Dynamic weather colors based on conditions
- Air quality information (when available)
- Interactive weather map links

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/discord-weather-bot.git
   cd discord-weather-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following values:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   OPENWEATHER_API_KEY=your_openweather_api_key
   CLIENT_ID=your_application_client_id
   GUILD_ID=optional_specific_guild_id
   ```

4. Create a Discord bot and get a token:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Copy the "Application ID" (this is your CLIENT_ID)
   - Navigate to the "Bot" tab and create a bot
   - Click "Reset Token" to get your bot token
   - Copy the token and add it to your `.env` file
   - Enable the "Message Content Intent" under Privileged Gateway Intents
   - Use the OAuth2 URL Generator with "bot" scope and appropriate permissions to invite the bot to your server

5. Get an OpenWeather API key:
   - Sign up at [OpenWeather](https://openweathermap.org/)
   - Generate an API key
   - Add the API key to your `.env` file

6. Deploy slash commands:
   ```
   npm run deploy-commands
   ```

7. Start the bot:
   ```
   npm start
   ```

   For development with auto-restart:
   ```
   npm run dev
   ```

   To keep the bot running 24/7:
   ```
   npm run setup-pm2
   ```

## Commands

### Slash Commands (/)
- `/weather` - Show weather for all saved locations
- `/weather [location]` - Show weather for a specific location
- `/addlocation <location>` - Add a location to saved locations
- `/removelocation <location>` - Remove a location from saved locations
- `/listlocations` - List all saved locations
- `/forecast <location>` - Get 5-day weather forecast
- `/weatherhelp` - Show help message with available commands

### Text Commands (!)
- `!weather` - Show weather for all saved locations
- `!weather <location>` - Show weather for a specific location
- `!addlocation <location>` - Add a location to saved locations
- `!removelocation <location>` - Remove a location from saved locations
- `!listlocations` - List all saved locations
- `!forecast <location>` - Get 5-day weather forecast
- `!help` - Show help message with available commands

## Screenshots

### Current Weather Display
Shows all critical weather information in a clean, organized layout:
- Current conditions with descriptive emoji
- Temperature with "feels like" reading
- Humidity and wind information
- Cloudiness and visibility readings
- Air quality (when available)
- Links to weather maps
<img width="1223" alt="Screenshot 2025-03-22 at 7 01 40 PM" src="https://github.com/user-attachments/assets/8162d6a7-013e-4e60-8c3d-9cdb8d419b50" />

### Multi-location Display
When checking multiple saved locations:
- Each location shows key information at a glance
- Current temperature and conditions
- Humidity and wind data
- Clear visual organization
<img width="1223" alt="Screenshot 2025-03-22 at 7 01 45 PM" src="https://github.com/user-attachments/assets/a217fbbf-15bd-430c-8bf2-e0b26f1dd838" />

### 5-Day Forecast Display
Shows forecast with:
- Daily temperature ranges
- Precipitation probability
- Weather conditions
- Organized in a 2-column layout for easy reading
<img width="1223" alt="Screenshot 2025-03-22 at 7 01 34 PM" src="https://github.com/user-attachments/assets/b98c3518-43fc-4022-a308-c79eceb07819" />

## Data Storage

The bot stores location data in a JSON file at `data/locations.json`. This file is created automatically when the first location is added.

## PM2 Commands

To manage the bot with PM2:

- Start: `npm run setup-pm2`
- Stop: `pm2 stop weather-bot`
- Delete: `pm2 delete weather-bot`
- Restart: `pm2 restart weather-bot --update-env` 
- View logs: `npm run logs`

## License

MIT
