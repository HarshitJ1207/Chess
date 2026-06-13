# Stage 1: Build React client
FROM node:22-alpine AS react-build

WORKDIR /app

# Copy client source
COPY client/package*.json ./

# Install dependencies
RUN npm install

# Copy source and build
COPY client/ ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy React build output to Nginx root
COPY --from=react-build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
