#!/usr/bin/env python3

import os
import flask
import argparse
from stream import Stream
from utils import rest_property
import subprocess
import re

class AppConfig:
    host = "0.0.0.0"
    port = 8050
    ssl_key = os.getenv("SSL_KEY")
    ssl_cert = os.getenv("SSL_CERT")
    title = "Excavator Camera Monitor System"
    inputs = "/dev/video4"

class CameraConfig(AppConfig):
    # options={'codec': 'h264', 'bitrate': 40000000}
    options={'codec': 'h264', 'bitrate': 4000000}

class RTSPConfig:
     ip = "rtsp://192.168.20.71/mpeg4"

def get_camera_devices():
	command = "ls -l /dev/video* | awk '{print $NF}'"
	process = subprocess.Popen(
		command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
	)
	stdout, stderr = process.communicate()
	camera_devices = None
	if process.returncode == 0:
		camera_devices = stdout.decode().strip().split("\n")
	else:
		camera_devices = stderr.decode()
	return camera_devices

def set_camera_config(camera_config,camera_device,port):
     camera_config.input = camera_device
     camera_config.name = "Camera_"+ re.findall(r'\d+', camera_device)[0]
     camera_config.port = port
     return camera_config

camera_devices = get_camera_devices()
camera_devices.append("rtsp://192.168.20.71/mpeg4")
app_config = AppConfig()

camera_configs = [CameraConfig() for i in range(len(camera_devices))]
camera_configs = [set_camera_config(camera_config=config,camera_device=camera_devices[i],port=8554+i) for i, config in enumerate(camera_configs)]
app_config.num_of_camera = len(camera_devices)
# config2 = CameraConfig()

# for data in camera_configs:
#      print(data.input, data.name, data.port)
# exit()

# create Flask & stream instance
app = flask.Flask(__name__)
# stream = Stream(config2)
streams = [Stream(data) for data in camera_configs]

for data in streams:
     print(data.input, data.name, data.port)
stream = streams[0]
print("here",app_config.inputs.startswith("webrtc"),)
# exit()
@app.route("/")
def index():
    return flask.render_template(
        "index.html",
        title=app_config.title,
        send_webrtc=app_config.inputs.startswith("webrtc"),
        input_stream="config.inputs",
        output_stream=stream.output_url
        # detection="ddd",
    )


@app.route("/recording/enabled", methods=["GET", "PUT"])
def recording_enabled():
    print("ccccc")
    print(stream.name)
    print("ccccc")

    def get_record():
        return stream.record
    def set_record(value):
        for i in streams:
             i.record = value
    return rest_property(get_record, set_record, bool)



@app.route('/recording/raw_start_frame_cut', methods=['GET', 'PUT'])
def recording_raw_start_frame_cut():
    print("stream.start_frame_cut",stream.start_frame_cut)
    def get_cut_value():
        return stream.start_frame_cut

    def set_cut_value(value):
        stream.prev_images=[]
        stream.start_frame_cut = value
    return rest_property(get_cut_value,set_cut_value, float)
      
# @app.route('/recording/stream_start_frame_cut', methods=['GET', 'PUT'])
# def recording_stream_start_frame_cut():
#     def get_cut_value():
#         pass

#     def set_cut_value(value):
#         pass
#     return rest_property(get_cut_value,set_cut_value, float)

for streama in streams:
    streama.start()


# check if HTTPS/SSL requested
ssl_context = None

if app_config.ssl_cert and app_config.ssl_key:
    ssl_context = (app_config.ssl_cert, app_config.ssl_key)

# start the webserver
app.run(
    host=app_config.host,
    port=app_config.port,
    ssl_context=ssl_context,
    debug=True,
    use_reloader=False,
)
