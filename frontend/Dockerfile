FROM node:carbon

RUN npm install twitter
RUN npm install express
RUN npm install dotenv
RUN npm install mysql
# Bundle app source
COPY . .

EXPOSE 8080
CMD [ "node", "core.js"]