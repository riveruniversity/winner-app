**Web App Overview**:

- Develop a single-page web application that randomly selects a specified number of people from a list and displays the winners in an engaging, visually appealing format optimized for wide-screen displays (e.g., large monitors or projectors).
- The app must include a **list manager** to handle list operations, a **settings page** for configuring options, and a **winner management system** to store and manage winners.
- Lists can contain up to 20,000 entries, and the app must store and retrieve lists efficiently using **IndexedDB** for local storage on the user's device.
- The UI must have an elegant and modern design, featuring:
- A clean, minimalist layout with ample whitespace and a professional color palette (e.g., soft grays, whites, and accent colors).
- Modern typography using a sans-serif font (e.g., Inter or Poppins via Google Fonts).
- Subtle hover effects, smooth transitions, and micro-animations for interactive elements (e.g., buttons, dropdowns).
- A responsive card-based design for sections, with shadows and rounded corners for depth.
- A cohesive visual hierarchy with larger headings, clear labels, and consistent spacing.

**List Manager Requirements**:

- Allow users to upload CSV files containing lists of people (up to 20,000 rows).
- Parse CSV files and display their contents for management (e.g., view, edit, or delete lists).
- Provide a setting to configure how winner names are displayed:
- Users can select one or more columns from the CSV to form the displayed name.
- For each column after the first, users specify a delimiter string to combine values.
- Store lists locally in IndexedDB for fast retrieval and persistence across sessions.
- Support basic list operations: create, save, load, and delete lists.
- Manage a **winners list** stored in IndexedDB, including:
- Storing winners with their entire original record (all CSV columns), a unique 5-character ID (capital letters and digits), the prize they won, and the timestamp of their win.
- Displaying the winners list in a table with columns for the unique ID, all record fields, prize, timestamp, and actions to edit or delete individual winners.
- Exporting the winners list as a CSV file with columns for the unique ID, all record fields, prize, and timestamp.
- Include a button in the list manager to clear the entire winners list.

**Random Selection and Winner Display**:

- Allow users to specify the number of winners to select randomly from the current list on the home page, and use this number for each draw.
- Allow users to select a prize for the current draw from a list of saved prizes (configured in the settings), with each prize having a quantity to track availability.
- Display winners in a visually appealing, animated format suitable for wide-screen displays (e.g., large text with fade-in animations, centered layout, customizable theme colors, and the prize displayed at the top).
- Ensure the random selection process is fair and efficient, even for lists with 20,000 entries.
- Store each winner in IndexedDB with their entire original record, a unique 5-character ID, selected prize, and timestamp of the win.
- Provide an option (configurable in settings) to remove winners from the source list after they win to prevent duplicate winnings.
- Support **undo functionality** for winner selections (restoring the source list and removing the winners from the winners list) and winner deletions (restoring deleted winners).
- Provide a button on the home page to toggle full-screen mode for public display using the Fullscreen API.

**Settings Page Requirements**:

- Provide a settings page to configure the following options:
- **Display Speed**: Number of seconds to display each winner or the total animatin duration for showing all winners. All winners need to be displayed on one page or sliding pagination.
- **Theme Colors**: Customize the app’s visual theme (e.g., background color, text color, accent colors for buttons and winner display).
- **Prize Management**: Add, edit, or delete prizes with associated quantities (e.g., “Gift Card” with 10 available, “T-Shirt” with 5 available). Prizes and their quantities are stored in IndexedDB and available for selection on the home page. Prevent selecting a prize with zero quantity.
- **Prevent Duplicate Winners**: A toggle to enable/disable removing winners from the source list after they win to avoid duplicate winnings.
- Save settings locally in IndexedDB so they persist across sessions.

**Technical Constraints**:

- Use **IndexedDB** for storing lists, winners, prizes, and settings due to its ability to handle large datasets efficiently.
- Ensure the app is responsive but optimized for wide-screen displays (e.g., 1920x1080 or larger).
- Avoid external dependencies for core functionality (e.g., CSV parsing, random selection, and CSV export should be implemented in JavaScript).
- Use css library (via CDN) for styling to ensure a modern, customizable UI, with:
- A modern design system including card layouts, shadows, rounded corners, and smooth hover effects.
- A professional color scheme and modern typography (e.g., via Google Fonts).
- Use a toast notification library (via CDN) for modern toast notifications instead of window.alert or window.confirm for all user confirmations and messages, styled to match the app’s aesthetic.
- The app must be a single HTML file with inline JavaScript and CSS for portability and ease of use.
- Implement CSV export for the winners list using a client-side download (e.g., creating a Blob and triggering a download).

**Performance Considerations**:

- Optimize list operations (e.g., parsing, random selection) to handle 20,000 entries without significant delays.
- Ensure smooth animations for winner display without performance issues on modern browsers.
- Minimize memory usage during CSV parsing, list storage, and winner management.
- Optimize IndexedDB operations to handle frequent reads/writes for winners, prizes, and undo actions.
- Ensure UI animations and transitions are efficient and do not impact performance for large datasets.

### 📁 IndexedDB Schema & Object Stores

Recommended stores:
- **Lists**: keyPath = `listId`, value = metadata (CSV columns, timestamp)
- **Entries**: keyPath = composite key (`listId + rowId`)
- **Winners**: keyPath = `winnerId`, with full original record, selected prize, and timestamp
- **Prizes**: keyPath = `prizeId`, with name & quantity
- **Settings**: keyPath = fixed singleton like `"settings"` or versioned key
IndexedDB best practices: use `onupgradeneeded` to initialize