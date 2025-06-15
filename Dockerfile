FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Expose the API port
EXPOSE 3000

# Command to run the app
CMD ["node", "src/index.js"]
