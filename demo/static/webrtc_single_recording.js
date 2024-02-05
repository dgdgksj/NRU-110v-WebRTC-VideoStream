/*
 * Copyright (c) 2023, NVIDIA CORPORATION. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */
var connections = {};
var mediaRecorder;
var recordedBlobs;
var remoteStream;
var remoteStreams;
var stopTime;
function reportError(msg) {
  console.log(msg);
}

function getWebsocketProtocol() {
  return window.location.protocol == 'https:' ? 'wss://' : 'ws://';
}

function getWebsocketURL(name, port = 8554) {
  console.log(name + '이건 대체 뭘까' + `${getWebsocketProtocol()}${window.location.hostname}:${port}/${name}`);
  return `${getWebsocketProtocol()}${window.location.hostname}:${port}/${name}`;
}

function checkMediaDevices() {
  return (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !navigator.mediaDevices.enumerateDevices) ? false : true;
}

function onIncomingSDP(url, sdp) {
  console.log('Incoming SDP: (%s)' + JSON.stringify(sdp), url);

  function onLocalDescription(desc) {
    console.log('Local description (%s)\n' + JSON.stringify(desc), url);
    connections[url].webrtcPeer.setLocalDescription(desc).then(function () {
      connections[url].websocket.send(JSON.stringify({ type: 'sdp', 'data': connections[url].webrtcPeer.localDescription }));
    }).catch(reportError);
  }

  connections[url].webrtcPeer.setRemoteDescription(sdp).catch(reportError);

  if (connections[url].type == 'inbound') {
    connections[url].webrtcPeer.createAnswer().then(onLocalDescription).catch(reportError);
  }
  else if (connections[url].type == 'outbound') {
    var constraints = { 'audio': false, 'video': { deviceId: connections[url].deviceId } };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      console.log('Adding local stream (deviceId=%s)', connections[url].deviceId);
      connections[url].webrtcPeer.addStream(stream);
      connections[url].webrtcPeer.createAnswer().then(onLocalDescription).catch(reportError);
    }).catch(reportError);
  }
}

function onIncomingICE(url, ice) {
  var candidate = new RTCIceCandidate(ice);
  console.log('Incoming ICE (%s)\n' + JSON.stringify(ice), url);
  connections[url].webrtcPeer.addIceCandidate(candidate).catch(reportError);
}



function onAddRemoteStream(event) {
  var url = event.srcElement.url;
  console.log('Adding remote stream to HTML video player (%s)', url);

  var videoElement = connections[url].videoElement;
  videoElement.srcObject = event.streams[0];

  videoElement.addEventListener('loadeddata', function () {
    videoElement.play().catch(function (error) {
      console.error('Video play failed for (%s):', url, error);
    });
  });

  remoteStream = event.streams[0];
  remoteStreams.push(remoteStream)
}


function toggleRecording(checkbox) {
  if (checkbox.checked) {
    startRecording();
  } else {
    stopRecording();
  }
}

function startRecording() {
  if (!remoteStream) {
    console.error('No remote stream available.');
    return;
  }


  recordedBlobs = [];
  // let options = { mimeType: 'video/webm;codecs=vp8' };
  let options = { mimeType: 'video/x-matroska;codecs=h264' };
  // let options = { mimeType: 'video/mp4' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not Supported`);
    options = { mimeType: 'video/webm;codecs=vp8' };
  }
  try {
    mediaRecorder = new MediaRecorder(remoteStream, options);
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start();
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
  }
}


function download() {
  if (recordedBlobs.length) {
    // var sliderValue = document.getElementById('recording_stream_start_frame_cut').value;
    // console.log("여기에요",sliderValue);
    const blob = new Blob(recordedBlobs, { type: 'video/x-matroska;codecs=h264' }); // Blob 객체 생성 추가
    // const blob = new Blob(recordedBlobs, { type: 'video/webm;codecs=vp8' }); // Blob 객체 생성 추가
    // const blob = new Blob(recordedBlobs, { type: 'video/mp4' }); // Blob 객체 생성 추가
    console.log('Download Blob size:', blob.size);
    console.log('Recorded Blobs:', recordedBlobs);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');

    // const filename = `${stopTime.getFullYear()}-${('0' + (stopTime.getMonth() + 1)).slice(-2)}-${('0' + stopTime.getDate()).slice(-2)} ${('0' + stopTime.getHours()).slice(-2)}-${('0' + stopTime.getMinutes()).slice(-2)}-${('0' + stopTime.getSeconds()).slice(-2)}`;
    // const filename = `${stopTime.getFullYear()}-${('0' + (stopTime.getMonth() + 1)).slice(-2)}-${('0' + stopTime.getDate()).slice(-2)} ${('0' + stopTime.getHours()).slice(-2)}-${('0' + stopTime.getMinutes()).slice(-2)}-${('0' + stopTime.getSeconds()).slice(-2)}.mp4`;

    a.style.display = 'none';
    a.href = url;
    // a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
}

function handleDataAvailable(event) {
  console.log('Data available: size =', event.data.size);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function stopRecording() {
  if (mediaRecorder) {
    mediaRecorder.onstop = function () {
      console.log("녹화 완전히 중단됨: ", new Date());
      // 녹화가 완전히 중단된 후 필요한 작업 수행
      // 예: 녹화된 데이터를 처리하거나 UI 업데이트
    };
    stopTime = new Date();
    mediaRecorder.stop();
  }
}
function onIceCandidate(event) {
  var url = event.srcElement.url;

  if (event.candidate == null)
    return;

  console.log('Sending ICE candidate out (%s)\n' + JSON.stringify(event.candidate), url);
  connections[url].websocket.send(JSON.stringify({ 'type': 'ice', 'data': event.candidate }));
}



function onServerMessage(event) {
  var msg;
  var url = event.srcElement.url;

  try {
    msg = JSON.parse(event.data);
  } catch (e) {
    return;
  }

  if (!connections[url].webrtcPeer) {
    connections[url].webrtcPeer = new RTCPeerConnection(connections[url].webrtcConfig);
    connections[url].webrtcPeer.url = url;

    connections[url].webrtcPeer.onconnectionstatechange = (ev) => {
      console.log('WebRTC connection state (%s) ' + connections[url].webrtcPeer.connectionState, url);


    }

    if (connections[url].type == 'inbound') {
      connections[url].webrtcPeer.ontrack = onAddRemoteStream;
    }

    connections[url].webrtcPeer.onicecandidate = onIceCandidate;
  }

  switch (msg.type) {
    case 'sdp': onIncomingSDP(url, msg.data); break;
    case 'ice': onIncomingICE(url, msg.data); break;
    default: break;
  }
}

function playStream(urls, videoElements) {
  console.log("이건 urls",urls)
  console.log("이건 videoElements",videoElements)

  for (var i = 0; i < urls.length; i++) {
    url= urls[i]
    videoElement = videoElements[i]

    connections[url] = {};

    connections[url].type = 'inbound';
    connections[url].videoElement = videoElement;
    connections[url].webrtcConfig = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };

    connections[url].websocket = new WebSocket(url);
    connections[url].websocket.addEventListener('message', onServerMessage);
  }    
}
