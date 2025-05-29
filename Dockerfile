# 1. Use Node.js base image
FROM node:18-alpine AS build

# 2. Set working directory
WORKDIR /app

# 3. Copy package.json and package-lock.json (for caching)
COPY package*.json ./

# 4. Install dependencies (including devDependencies)
RUN npm install

# 5. Install turbo globally
RUN npm install -g turbo

# 6. Copy all source files
COPY . .

# 7. Run build using turbo
RUN npm run build

# 8. Production image
FROM node:18-alpine AS production

# 9. Set working directory
WORKDIR /app

# 10. Copy only built app and necessary files from build stage
COPY --from=build /app ./

# 11. Install only production dependencies
RUN npm install --omit=dev

# 12. Expose Medusa default port
EXPOSE 9000

# 13. Start Medusa server
CMD ["npm", "start"]
