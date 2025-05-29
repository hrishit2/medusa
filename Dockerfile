FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Ignore peer dependency issues (temporary workaround)
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

RUN npm install

COPY . .

RUN npm run build

EXPOSE 9000

CMD ["npm", "run", "start"]
