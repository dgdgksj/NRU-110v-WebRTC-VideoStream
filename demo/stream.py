#!/usr/bin/env python3
#
# Copyright (c) 2023, NVIDIA CORPORATION. All rights reserved.
#
# Permission is hereby granted, free of charge, to any person obtaining a
# copy of this software and associated documentation files (the 'Software'),
# to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Software, and to permit persons to whom the
# Software is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
# THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
# DEALINGS IN THE SOFTWARE.
#
import sys
import threading
import traceback
from datetime import datetime
from jetson_utils import videoSource, videoOutput, cudaFont


class Stream(threading.Thread):
    """
    Thread for streaming video and applying DNN inference
    """
    def __init__(self, config):
        """
        Create a stream from input/output video sources, along with DNN models.
        """
        super().__init__()
        
        self.config = config
        self.name = config.name
        self.port =config.port
        self.input = videoSource(config.input)
        self.output_url = "webrtc://@:"+str(self.port)+"/output"
        self.output = videoOutput(self.output_url,options=config.options)
        self.prev_images = []
        self.has_recorded_prev_images = True
        self.frames = 0
        self.models = {}
        self.record = False
        self.font = cudaFont(size=32)
        self.pass_cnt =0
        self.start_frame_cut = 999
        self.buf = []
        self.output_temp = videoOutput(self.name+'_temp.mp4')
        self.record_ch = False
    def overlay_text(self, img, font, text, x, y, color, background):
        font.OverlayText(img, img.width, img.height, text, x, y, color, background)
        return img
    def start_recording(self,*config):
        self.record = config[0]
    def process(self):
        """
        Capture one image from the stream, process it, and output it.
        # """
        # print(self.config.inputs)
        img = self.overlay_text(img=self.input.Capture(), font=self.font, text=self.name +", "+str(datetime.now()), x=5, y=5, color=(255, 0, 0), background=(0, 0, 0))
        if img is None:  # timeout
            return
        # if len(self.prev_images) >= self.start_frame_cut:  # 최대 2개의 이미지만 저장
        #     # print("len(self.prev_images)",len(self.prev_images),"self.start_frame_cut",self.start_frame_cut)
        #     self.prev_images.pop(0)  # 가장 오래된 이미지 제거
        # self.prev_images.append(img)
        
        
        try:
            self.output.Render(img)
        except:
            self.output = videoOutput(self.output_url,options=self.config.options)

        if self.record:
            self.record_ch =True
            self.output_temp.Render(img)
            # print("녹화중")
        elif self.record_ch:
            # self.has_recorded_prev_images = True
            # print("녹화ㄲ<ㅡ")
            self.record_ch = False
            self.output_temp.Close()

        self.frames += 1
    def run(self):
        """
        Run the stream processing thread's main loop.
        """
        while True:
            try:
                self.process()
            except:
                traceback.print_exc()
                
    @staticmethod
    def usage():
        """
        Return help text for when the app is started with -h or --help
        """
        return videoSource.Usage() + videoOutput.Usage() + Model.Usage()
        