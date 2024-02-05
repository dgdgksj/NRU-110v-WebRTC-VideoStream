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
var remoteStreams = [];
var stopTime;
var recordedBlob_is_none =true
var mediaRecorders = [];
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

  // remoteStream = event.streams[0];
  remoteStreams.push(event.streams[0])
}


function toggleRecording(checkbox) {
  if (checkbox.checked) {
    startRecording();
  } else {
    stopRecording();
  }
}

function startRecording() {
  // console.log("여기는",remoteStreams.length)
  // console.log("여기는",!remoteStreams.length)
  if (!remoteStreams.length) {
    console.error('No remote stream available.');
    return;
  }

  recordedBlobs = [];
  mediaRecorders = []
    

  // let options = { mimeType: 'video/webm;codecs=vp9' };
  let options = { mimeType: 'video/x-matroska;codecs=h264' };
  // let options = { mimeType: 'video/mp4' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not Supported`);
    // options = { mimeType: 'video/webm;codecs=vp8' };
  }
  for (var i = 0; i < remoteStreams.length; i++) {
    
    try {
      console.log("시작됨",i)
      mediaRecorder = new MediaRecorder(remoteStreams[i], options);
      mediaRecorder.ondataavailable = handleDataAvailable;
      mediaRecorder.start();
      mediaRecorders.push(mediaRecorder)
    } catch (e) {
      console.error('Exception while creating MediaRecorder:', e);
    }
  }
  
}


function download() {
  var zip = new JSZip();
  // 모든 녹화된 블롭들을 ZIP 파일에 추가
  recordedBlobs.forEach((blob, index) => {
    zip.file(`recording-${index + 1}.mkv`, blob);
  });

  // ZIP 파일 생성 및 다운로드
  zip.generateAsync({type:"blob"}).then(function(content) {
    // content에는 생성된 ZIP 파일의 블롭이 포함됩니다.
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = "recordings.zip";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  });
}
function handleDataAvailable(event) {
  console.log("4번호출ㄷ욈?")
  console.log('Data available: size =', event.data.size);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function stopRecording() {
  if (mediaRecorders.length) {
    for (var i = 0; i < mediaRecorders.length; i++) {
      mediaRecorder = mediaRecorders[i]
      mediaRecorder.onstop = function () {
        console.log("녹화 완전히 중단됨: ", new Date());
        // 녹화가 완전히 중단된 후 필요한 작업 수행
        // 예: 녹화된 데이터를 처리하거나 UI 업데이트
      };
      stopTime = new Date();
      mediaRecorder.stop();
    }
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

function playStream2(url, videoElement) {
  connections[url] = {};

  connections[url].type = 'inbound';
  connections[url].videoElement = videoElement;
  connections[url].webrtcConfig = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };

  connections[url].websocket = new WebSocket(url);
  connections[url].websocket.addEventListener('message', onServerMessage);
  connections[url].videoElement = videoElement;
  connections[url].videoElement = videoElement;
  connections[url].videoElement = videoElement;
  connections[url].videoElement = videoElement;
  connections[url].videoElement = videoElement;
}


function setupVideoPlayer(videoPlayer, videoStream) {
  videoPlayer.onerror = function(event) {
    console.error("Video playback error detected for", videoPlayer.id, event);
    // 에러 발생 시 해당 비디오에 대해 스트림 재생 시도
    playStream2(videoStream, videoPlayer);
  };
  playStream2(videoStream, videoPlayer); // 초기 비디오 스트림 재생
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
    connections[url].videoElement = videoElement;
    connections[url].videoElement = videoElement;
    connections[url].videoElement = videoElement;
    connections[url].videoElement = videoElement;
    connections[url].videoElement = videoElement;
  }
}

