<script setup lang="ts">
defineOptions({
  name: "DetectPic"
});

import { UploadFilled } from "@element-plus/icons-vue";
import { ElMessage, genFileId, UploadInstance } from "element-plus";
import { UploadFile } from "element-plus";
import { UploadFiles } from "element-plus";
import { UploadRawFile } from "element-plus";
import { UploadProps, UploadUserFile } from "element-plus";
import { computed, ref } from "vue";
import * as utils from "./utils";
import { UploadRequestHandler } from "element-plus";
import Constants from "../../../config/constants/api";

const detectedResultBlobUrl = ref("");
const uploadUrl = computed(() => {
  return `${Constants.BACKEND_URL}/image`;
});
// 上传文件列表
const uploadFileList = ref<UploadUserFile[]>([]);
const upload = ref<UploadInstance>();

// 缩略图预览
const previewDialogVisible = ref(false);
const previewImageUrl = ref("");
const handlePreview: UploadProps["onPreview"] = uploadFile => {
  previewDialogVisible.value = true;
  previewImageUrl.value = uploadFile.url!;
};

// 上传文件超过限制，清空原有的文件
const handleExceed: UploadProps["onExceed"] = files => {
  upload.value!.clearFiles();
  const file = files[0] as UploadRawFile;
  file.uid = genFileId();
  upload.value!.handleStart(file);
};

// 上传文件
const handleUpload = () => {
  if (uploadFileList.value.length === 0) {
    ElMessage.error("请先上传图片");
    return;
  }
  console.log("click upload");
  upload.value!.submit();
};

// 文件上传成功，拿到对应的结果
const handleOnSuccess = (
  response: any,
  uploadFile: UploadFile,
  uploadFiles: UploadFiles
): void => {
  ElMessage.success("上传成功");
  if (response instanceof Blob) {
    detectedResultBlobUrl.value = URL.createObjectURL(response);
  } else {
    ElMessage.error("请上传图片");
  }
};

// 上传失败
const handleOnError = (
  error: any,
  uploadFile: UploadFile,
  uploadFiles: UploadFiles
): void => {
  ElMessage.error("上传失败");
  console.error("post error", error);
};

// 清空文件
function handleClearFiles() {
  upload.value!.clearFiles();
}

const customUpload = ref<UploadRequestHandler>(utils.ajaxUploadAndGetFile);
</script>

<template>
  <el-container>
    <el-row class="container-row w-full justify-around">
      <el-col :span="11">
        <el-text class="title">上传图片</el-text>
        <el-upload
          ref="upload"
          v-model:file-list="uploadFileList"
          class="upload-demo"
          drag
          :action="uploadUrl"
          :auto-upload="false"
          list-type="picture"
          accept="image/*"
          :limit="1"
          :http-request="utils.ajaxUploadAndGetFile"
          :on-preview="handlePreview"
          :on-exceed="handleExceed"
          :on-success="handleOnSuccess"
          :on-error="handleOnError"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽文件上传 或 <em>点击选择文件上传</em>
          </div>
          <template #tip>
            <el-text type="info"
              >上传图片文件，支持 png、jpg、jpeg 等格式 (点击可以预览)
            </el-text>
          </template>
        </el-upload>
        <div class="w-full flex justify-end">
          <el-button
            type="danger"
            class="mt-4"
            :disabled="uploadFileList.length === 0"
            @click="handleClearFiles"
            >清空
          </el-button>
          <el-button
            type="primary"
            class="mt-4"
            :disabled="uploadFileList.length === 0"
            @click="handleUpload"
            >检测
          </el-button>
        </div>
      </el-col>
      <el-col :span="1" class="flex justify-center">
        <el-divider direction="vertical" style="height: 100%" />
      </el-col>
      <el-col :span="12">
        <el-text class="title">检测结果</el-text>
        <el-empty v-if="!detectedResultBlobUrl" description="未上传图片" />
        <img v-else :src="detectedResultBlobUrl" />
      </el-col>
    </el-row>
    <el-dialog v-model="previewDialogVisible">
      <img w-full :src="previewImageUrl" alt="Preview Image" />
    </el-dialog>
  </el-container>
</template>

<style lang="scss" scoped>
.el-container {
  width: 100%;
  height: 100%;
  padding: 20px;
  background-color: white;
}

.el-col {
  height: 100%;
}

.title {
  display: block;
  width: 100%;
  margin-bottom: 20px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
}
</style>
