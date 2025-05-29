FROM node:18

WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies with legacy peer deps flag
RUN npm install --legacy-peer-deps

# Then copy the rest of the app
COPY . .

EXPOSE 9000
CMD ["npm", "run", "start"]
