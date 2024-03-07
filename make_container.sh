#!/bin/bash

# ?? ???? ??
CURRENT_DIR=$(pwd)

# ?? ???? ??? ??
BASE_CONTAINER_IMAGE="dustynv/jetson-inference:r32.7.1"

# ? ???? ???? ?? ??
NEW_IMAGE_NAME="test_image"
NEW_CONTAINER_NAME="test"
TEMP_CONTAINER_NAME="temp_for_copy"

# ?? ???? ?? (???? ??)
docker rm -f $TEMP_CONTAINER_NAME || true


docker rm -f $NEW_CONTAINER_NAME || true


docker run -d --name $TEMP_CONTAINER_NAME $BASE_CONTAINER_IMAGE


docker exec $TEMP_CONTAINER_NAME bash -c "rm -rf /jetson-inference && mkdir -p /webRTC_server"


docker cp $CURRENT_DIR/. $TEMP_CONTAINER_NAME:/webRTC_server


COMMITTED_IMAGE=$(docker commit $TEMP_CONTAINER_NAME)


docker rm -f $TEMP_CONTAINER_NAME


cat > Dockerfile.temp <<EOF
FROM $COMMITTED_IMAGE
WORKDIR /webRTC_server/demo
RUN echo "export SSL_KEY=/webRTC_server/asset/key.pem" >> /root/.bashrc && \
    echo "export SSL_CERT=/webRTC_server/asset/cert.pem" >> /root/.bashrc
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y gstreamer1.0-x x11-apps cmake build-essential
#WORKDIR /webRTC_server/build
#RUN cmake ../ && make && make install && ldconfig

WORKDIR /webRTC_server/demo


EOF

# Dockerfile? ???? ?? ??? ??
docker build -f Dockerfile.temp -t $NEW_IMAGE_NAME .

# ?? Dockerfile ??
rm Dockerfile.temp

# ? ???? ??
docker run -it --privileged --name $NEW_CONTAINER_NAME $NEW_IMAGE_NAME

