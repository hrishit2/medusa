FROM node:18-alpine

WORKDIR /app

# Copy only package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Now copy the rest of the app
COPY . .

# Build the app
RUN npm run build

EXPOSE 9000

CMD ["npm", "run", "start"]
