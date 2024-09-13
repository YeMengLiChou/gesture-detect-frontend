<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref } from "vue";
import { io } from "socket.io-client";
import { ElMessage } from "element-plus";

defineOptions({
  name: "DetectVideo"
});

// 显示摄像头内容的 video
const showVideo = ref<HTMLVideoElement>();

// 显示处理内容的 canvas
const showCanvas = ref<HTMLCanvasElement>();
let showContext: CanvasRenderingContext2D = null;

// 用于抽帧的 canvas
let tmpCanvas: HTMLCanvasElement = null;
let tmpContext: CanvasRenderingContext2D = null;

// 相机的状态
enum CameraStatus {
  Stop = 1, // 相机关闭
  Loading = 2, // 相机加载
  Start = 3 // 相机启动中
}

let cameraStatus = ref(CameraStatus.Stop);
// 抽帧的间隔 Timeout
let frameCaptureInterval = null;
// 相机视频流，用于停止
let cameraStream = null;
// 相机的宽高
let cameraWidth = 0;
let cameraHeight = 0;

// 每秒发送的帧数，最终帧率受到服务器处理影响
const fps = ref(10);

// 发送/接收帧数
const sendFrameCount = ref(0);
const receiveFrameCount = ref(0);
const renderFrameCount = ref(0);
const startHandleTime = ref(0);

let previousFrameReviceTime = 0;

// 接受的平均帧率
const averageRecviceFps = computed(() => {
  return (
    receiveFrameCount.value /
    ((Date.now() - startHandleTime.value) / 1000)
  ).toFixed(2);
});

// 发送的平均帧率
const averageSendFps = computed(() => {
  return (
    sendFrameCount.value /
    ((Date.now() - startHandleTime.value) / 1000)
  ).toFixed(2);
});

const averageRenderFps = computed(() => {
  return (
    renderFrameCount.value /
    ((Date.now() - startHandleTime.value) / 1000)
  ).toFixed(2);
});

// const render

// 设置 sockio
const socketio = io("ws://localhost:5000");
const socketConnected = ref(false);

socketio.on("connect", () => {
  ElMessage.success("连接成功");
  socketConnected.value = true;
});

let currentFrameResult = [];

// 接受处理好的视频帧
socketio.on("message", async (data: ArrayBuffer) => {
  if (cameraStatus.value === CameraStatus.Stop) return;
  const blob = new Blob([data], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);
  currentFrameResult.push(bitmap);
  receiveFrameCount.value++;
});

socketio.on("disconnect", () => {
  if (!socketConnected.value) return;
  ElMessage.error("连接断开");
  socketConnected.value = false;
});

// 通过 socketio 发送视频帧
function sendVideoFrame(frame: Blob) {
  if (socketio.connected) {
    socketio.emit("frame", frame);
    sendFrameCount.value++;
  }
}

// 绘制结果帧
function drawFrame() {
  console.log("drawFrame");
  if (currentFrameResult.length > 0) {
    console.log(currentFrameResult);
    showContext.drawImage(
      currentFrameResult[0],
      0,
      0,
      cameraWidth,
      cameraHeight
    );
    currentFrameResult.shift();
    renderFrameCount.value++;
  }
  requestAnimationFrame(drawFrame);
}

// 开始摄像头
function startVideoCapture() {
  if (cameraStatus.value != CameraStatus.Stop) return;
  cameraStatus.value = CameraStatus.Loading;
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(stream => {
      cameraStream = stream;
      const settings = stream.getVideoTracks()[0].getSettings();
      cameraWidth = settings.width;
      cameraHeight = settings.height;

      // 设置 showCanvas 的宽高
      showCanvas.value.width = cameraWidth;
      showCanvas.value.height = cameraHeight;

      showVideo.value.addEventListener("loadeddata", () => {
        // 开始处理
        ElMessage.success("摄像头已启动");
        sendFrameCount.value = 0;
        receiveFrameCount.value = 0;
        startHandleTime.value = Date.now();

        cameraStatus.value = CameraStatus.Start;

        // 用于抽帧的 canvas
        tmpCanvas = document.createElement("canvas");
        tmpContext = tmpCanvas.getContext("2d");
        tmpCanvas.width = cameraWidth;
        tmpCanvas.height = cameraHeight;

        // 定时抽帧
        handleFpsChange(fps.value);
        drawFrame();
      });

      // 将摄像头内容显示到页面上
      showVideo.value.srcObject = stream;
      showVideo.value.muted = true;
      showVideo.value.play();
    })
    .catch(err => {
      ElMessage.error("获取摄像头失败");
      console.error(err);
      cameraStatus.value = CameraStatus.Stop;
    });
}

// 关闭摄像头
function stopVideoCapture() {
  showVideo.value.pause();
  showVideo.value.srcObject = null;
  if (frameCaptureInterval) {
    clearInterval(frameCaptureInterval);
  }
  cameraStatus.value = CameraStatus.Stop;
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

// 改变帧率
function handleFpsChange(value: number) {
  if (frameCaptureInterval) {
    clearInterval(frameCaptureInterval);
  }
  frameCaptureInterval = setInterval(() => {
    tmpContext.drawImage(showVideo.value, 0, 0, cameraWidth, cameraHeight);
    tmpCanvas.toBlob(async blob => {
      if (blob) {
        sendVideoFrame(blob);
      }
    }, "image/jpeg");
  }, 1000 / value);
}

onMounted(() => {
  showContext = showCanvas.value.getContext("2d");
});

onBeforeUnmount(() => {
  stopVideoCapture();
});
</script>

<template>
  <div class="container">
    <el-row :gutter="4">
      <el-col :span="11">
        <el-text class="title-text">摄像头</el-text>
        <el-empty
          v-show="cameraStatus === CameraStatus.Stop"
          class="camera"
          description="未开启摄像头"
        />
        <video
          v-show="cameraStatus !== CameraStatus.Stop"
          ref="showVideo"
          class="camera"
        />
        <el-row class="action-bar">
          <el-button
            type="info"
            :disabled="cameraStatus !== CameraStatus.Stop"
            @click="startVideoCapture"
            >启动
          </el-button>
          <el-button
            type="danger"
            :disabled="cameraStatus !== CameraStatus.Start"
            @click="stopVideoCapture"
            >停止</el-button
          >
        </el-row>
        <el-row style="justify-content: center; margin-top: 16px">
          <el-text>设置帧率：</el-text>
          <el-input-number
            v-model="fps"
            :min="1"
            :max="120"
            size="small"
            @change="handleFpsChange"
          />
        </el-row>
      </el-col>
      <el-col :span="1">
        <el-divider direction="vertical" style="height: 100%" />
      </el-col>
      <el-col :span="11">
        <el-text class="title-text">识别结果</el-text>
        <canvas
          v-show="receiveFrameCount !== 0"
          ref="showCanvas"
          class="camera"
        />
        <el-empty
          v-show="receiveFrameCount === 0"
          class="camera"
          description="暂无数据"
        />
        <div class="info-text">
          <el-text>服务器Scoket状态: </el-text>
          <el-tag v-if="socketConnected" type="success">已连接</el-tag>
          <el-tag v-else type="danger">未连接</el-tag>
        </div>
        <div class="info-text">
          <el-text
            >发送/接收/渲染帧数：{{ sendFrameCount }} /
            {{ receiveFrameCount }} / {{ renderFrameCount }}</el-text
          >
        </div>
        <div class="info-text">
          <el-text>当前发送帧率：{{ fps }}</el-text>
        </div>
        <div class="info-text">
          <el-text>平均发送帧率：{{ averageSendFps }}</el-text>
        </div>
        <div class="info-text">
          <el-text>平均接收帧率：{{ averageRecviceFps }}</el-text>
        </div>
        <div class="info-text">
          <el-text>平均渲染帧率：{{ averageRenderFps }}</el-text>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.container {
  background-color: #ffffff;
  padding: 20px;
  height: 100%;
  width: 100%;
}

.title-text {
  display: block;
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  width: 100%;
}

.camera {
  width: 680px;
  height: 480px;
  border-radius: 8px;
}

.action-bar {
  margin-top: 10px;
  justify-content: center;

  .el-button {
    margin-left: 16px;
    margin-right: 16px;
  }
}

.info-text {
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 16px;
}
</style>
