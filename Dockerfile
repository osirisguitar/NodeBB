# The base image is the latest 4.x node (LTS) on jessie (debian)
# -onbuild will install the node dependencies found in the project package.json
# and copy its content in /usr/src/app, its WORKDIR
FROM node:4-onbuild

ENV NODE_ENV=production \
    daemon=false \
    silent=false

# nodebb setup will ask you for connection information to a redis (default), mongodb then run the forum
# nodebb upgrade is not included and might be desired
CMD node app --setup="{\"url\":\"${siteurl}\",\"secret\":\"${mongosecret}\",\"database\":\"mongo\",\"mongo:host\":\"mongodb\",\"mongo:port\":27017,\"mongo:username\":\"\",\"mongo:password\":\"\",\"mongo:database\":0,\"redis:host\":\"redis\",\"redis:port\":6379,\"redis:password\":\"\",\"redis:database\":0,\"admin:username\":\"${adminusername}\",\"admin:email\":\"${adminuseremail}\",\"admin:password\":\"${adminuserpassword}\",\"admin:password:confirm\":\"${adminuserpassword}\"}" && ./nodebb upgrade && npm start

# the default port for NodeBB is exposed outside the container
EXPOSE 4567
