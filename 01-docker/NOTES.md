# Docker

### Containers

* *Containers* are workloads started from *container images*. 
* Container images live in libraries of images - *container registry*.
* [Docker Hub](https://hub.docker.com/) is one of larges and defaulf container registry for Docker.

* Have a look at official [NGINX container image](https://hub.docker.com/_/nginx) with documented usage and versions.
* Container images are layered filestetems of container and are published in many versions identified by *tags*.
* If *tag* is not specified, special tag *latest* is used.
* Using tag *latest* is not best practice as application might break on unexpected upgrade to future latest version.


#### Container images

```shell
# lets download our web server image
docker pull nginx
# notice this would have same meaning
docker pull nginx:latest
# similar to
docker pull library/nginx:latest
# or even
docker pull registry-1.docker.io/library/nginx:latest

# list images
docker image ls
# more
docker image

# e.g. whole image history / layers
docker image history nginx
# 
docker image history --no-trunc nginx
docker image history --format json nginx
docker image history --format json nginx | jq .
docker image history --no-trunc --format json nginx | jq -r .CreatedBy

docker image inspect nginx
```

#### Running containers

Lets run our web server
```shell
docker run nginx
# other terminal as it runs in foreground ...
curl localhost:80
# connection refused

# ctrl-c NGINX and retry bringing web server to hosts port 8080
docker run -p 8080:80 nginx
# other terminal
curl localhost:8080
# who is handling 8080 then?
sudo netstat -nap | grep 8080
```


#### Container volumes

Revisit the documentation of [NGINX image](https://hub.docker.com/_/nginx)
Usage mentiones way to serve own folder:

```shell
# tmp folder
cd $(mktemp -d)
# file to serve
mkdir www; echo "Hello world at $(date)" | sudo tee ./www/index.html

# lets stop previous server and run it again with command below
#   remember current folder!
docker run -p8080:80 -v ./www:/usr/share/nginx/html:ro nginx

# other terminal - check it
curl localhost:8080
# now your file created above is served

# detached - run as daemon - remember to stop old one
docker run -d -p8080:80 -v ./www:/usr/share/nginx/html:ro nginx
curl localhost:8080
# update and retry
echo "Hello world at $(date)" | sudo tee ./www/index.html
cat ./www/index.html
curl localhost:8080
```

What happens with container data when stopped?

```bash
# list RUNNING containers
docker ps
# list even previously finished containers
docker ps -a
# be careful - delete not running
docker rm $(docker ps -a -q)
# running remain
docker ps -a
# but can be stopped and deleted too
CONTAINERS=$(docker ps -a -q)
docker stop $CONTAINERS; docker rm $CONTAINERS
```

Can Docker manage volume for me (insted of moubting local folder of local machine)?
```shell
# create empty volume
docker volume create www
# and populate it
docker run -it --rm -v www:/www ubuntu bash -c 'date | tee /www/index.html'
# volume survived container termination and deletion (--rm above!)
docker run -it --rm -v www:/www ubuntu cat /www/index.html
docker ps
docker ps -a

# so we may serve the volume too:
docker run -d --rm -p8080:80 -v www:/usr/share/nginx/html:ro nginx
# check
curl localhost:8080

# one can also copy file to container
# mount rw, named web9090
docker run --name web9090 -d --rm -p9090:80 -v www:/usr/share/nginx/html:rw nginx
# update content
date > /tmp/date.txt
docker cp /tmp/date.txt web9090:/usr/share/nginx/html
# check it
curl localhost:8080
curl localhost:9090
```


#### Container network

```shell
# look at PORTS
docker ps
# who is handling them?
netstat -nap | egrep '8080|9090'
# web9090 details
docker inspect web9090
# yes - bridge networking has interface with private IP for all 
docker inspect web9090 | jq '.|keys'
docker inspect web9090 | jq '.[0]|keys'
docker inspect web9090 | jq '.[0].NetworkSettings'

# look for docker0
ip a
# participating in bridge
ls /sys/class/net/docker0/brif 

# available networks
docker network ls
# inspect
docker network inspect bridge
```

#### Build custom container

```shell
# content
echo "Hello. Time is now: $(date)" | tee hello.txt

# build recipe aka Dockerfile:
cat << EOF > Dockerfile
FROM nginx
COPY hello.txt /usr/share/nginx/html/index.html
EOF

cat Dockerfile

# build and tag
docker build -t webnow .

# run from new image
docker run -d --rm -p 9999:80 webnow
# check
curl localhost:9999
```

Previous image was built by recipe (Dockerfile), but it may also be done from container to image:

```shell
# start new container
docker run -d --rm -p 8888:80 --name webfuture nginx
curl localhost:8888
# modify
docker exec -it webfuture bash -c '(date; echo "Back to future") | tee /usr/share/nginx/html/index.html'
curl localhost:8888

# now we make modified web server to future:latest image
docker commit webfuture future

# remove and test
docker stop webfuture

docker run -d --rm -p 8888:80 --name webfuture future
curl localhost:8888
```