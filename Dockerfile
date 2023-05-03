FROM node:18-alpine
WORKDIR /usr/src/app

RUN apk -U add ffmpeg yt-dlp

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]