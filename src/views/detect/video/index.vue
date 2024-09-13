<script setup lang="ts">
import { onBeforeUnmount, onMounted, onUnmounted, ref } from "vue";
import { io } from "socket.io-client";
import { ElMessage } from "element-plus";

defineOptions({
  name: "DetectVideo"
});

// 显示摄像头内容
const showVideo = ref<HTMLVideoElement>();

// 显示处理内容
const showCanvas = ref<HTMLCanvasElement>();
let showContext: CanvasRenderingContext2D = null;

// 用于加载图片的 img
const image = new Image();
image.onload = () => {
  showContext.drawImage(
    image,
    0,
    0,
    showVideo.value.clientWidth,
    showVideo.value.clientHeight
  );
  URL.revokeObjectURL(image.src);
};
// 每秒发送的帧数，最终帧率受到服务器处理影响
const fps = 24;

// 设置 sockio
const socketio = io("ws://localhost:5000");
let socketConnected = false;
let sendFrameCount = ref(0);
let receiveFrameCount = ref(0);

socketio.on("connect", () => {
  ElMessage.success("连接成功");
  socketConnected = true;
});

// 接受处理好的视频帧
socketio.on("message", (data: ArrayBuffer) => {
  image.src = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));
  receiveFrameCount.value++;
});

socketio.on("disconnect", () => {
  if (!socketConnected) return;
  ElMessage.error("连接断开");
  socketConnected = false;
});

// 通过 socketio 发送视频帧
function sendVideoFrame(frame: Blob) {
  if (socketio.connected) {
    socketio.emit("frame", frame);
    sendFrameCount.value++;
  }
}

let cameraStarted = ref(false);
let frameCaptureInterval = null;
let cameraStream = null;

// 开始摄像头
function startVideoCapture() {
  if (cameraStarted.value) return;

  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(stream => {
      console.log("get camera success");
      cameraStream = stream;

      const settings = stream.getVideoTracks()[0].getSettings();
      const w = settings.width;
      const h = settings.height;
      // 无法提前准确获取到 clientWidth 和 clientHeight
      // 因此在加载完成后再进行抽帧
      showVideo.value.addEventListener("loadeddata", () => {
        sendFrameCount.value = 0;
        receiveFrameCount.value = 0;
        cameraStarted.value = true;
        // 用于抽帧的 canvas
        const tmpCanvas = document.createElement("canvas");
        // console.log("set-canvas-a", showVideo.value.clientWidth, showVideo.value.clientHeight);
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpContext = tmpCanvas.getContext("2d");

        // 定时抽帧
        frameCaptureInterval = setInterval(() => {
          tmpContext.drawImage(showVideo.value, 0, 0, w, h);
          tmpCanvas.toBlob(blob => {
            if (blob) {
              sendVideoFrame(blob);
            }
          }, "image/jpeg");
        }, 10000 / fps);
      });

      // 将摄像头内容显示到页面上
      showVideo.value.srcObject = stream;
      showVideo.value.muted = true;
      showVideo.value.play();
    })
    .catch(err => {
      ElMessage.error("获取摄像头失败");
      console.error(err);
    });
}

// 关闭摄像头
function stopVideoCapture() {
  showVideo.value.pause();
  showVideo.value.srcObject = null;
  if (frameCaptureInterval) {
    clearInterval(frameCaptureInterval);
  }
  cameraStarted.value = false;
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => {
      track.stop();
    });
    cameraStream = null;
  }
  showContext.clearRect(
    0,
    0,
    showCanvas.value.clientWidth,
    showCanvas.value.clientHeight
  );
}

onMounted(() => {
  showContext = showCanvas.value.getContext("2d");
});

onBeforeUnmount(() => {
  stopVideoCapture();
});
</script>

<template>
  <div>
    <el-row>
      <el-col :span="12">
        <el-text>摄像头</el-text>
        <div v-show="!cameraStarted" class="camera placeholder">
          <el-text>未开启摄像头</el-text>
        </div>
        <video v-show="cameraStarted" ref="showVideo" class="camera" />
        <el-button
          type="info"
          :disabled="cameraStarted"
          @click="startVideoCapture"
          >启动</el-button
        >
        <el-button type="danger" @click="stopVideoCapture">停止</el-button>
      </el-col>
      <el-col :span="12">
        <el-text>处理</el-text>
        <canvas ref="showCanvas" width="680" height="480" />
        <el-text>发送帧数：{{ sendFrameCount }}</el-text>
        <br />
        <el-text>接收帧数：{{ receiveFrameCount }}</el-text>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.camera {
  width: 680px;
  height: 480px;
}

.holder {
  background-color: #f0f0f0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
