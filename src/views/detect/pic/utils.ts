import { isNil } from "lodash-unified";
import { throwError } from "element-plus/es/utils/error.mjs";
import type { UploadRequestHandler, UploadRequestOptions } from "element-plus";
import { isArray } from "element-plus/es/utils/types.mjs";

const SCOPE = "ElUpload";

export class UploadAjaxError extends Error {
  name = "UploadAjaxError";
  status: number;
  method: string;
  url: string;

  constructor(message: string, status: number, method: string, url: string) {
    super(message);
    this.status = status;
    this.method = method;
    this.url = url;
  }
}

function getError(
  action: string,
  option: UploadRequestOptions,
  xhr: XMLHttpRequest
) {
  let msg: string;
  if (xhr.response) {
    msg = `${xhr.response.error || xhr.response}`;
  } else if (xhr.responseText) {
    msg = `${xhr.responseText}`;
  } else {
    msg = `fail to ${option.method} ${action} ${xhr.status}`;
  }

  return new UploadAjaxError(msg, xhr.status, option.method, action);
}

export const ajaxUploadAndGetFile: UploadRequestHandler = option => {
  if (typeof XMLHttpRequest === "undefined")
    throwError(SCOPE, "XMLHttpRequest is undefined");

  const xhr = new XMLHttpRequest();
  const action = option.action;

  // if (xhr.upload) {
  //   xhr.upload.addEventListener("progress", evt => {
  //     const progressEvt = evt as UploadProgressEvent;
  //     progressEvt.percent = evt.total > 0 ? (evt.loaded / evt.total) * 100 : 0;
  //     option.onProgress(progressEvt);
  //   });
  // }

  const formData = new FormData();
  if (option.data) {
    for (const [key, value] of Object.entries(option.data)) {
      if (isArray(value) && value.length) {
        formData.append(key, ...(value as [Blob, string]));
      } else if (typeof value === "string" || value instanceof Blob) {
        formData.append(key, value);
      }
    }
  }
  formData.append(option.filename, option.file, option.file.name);

  xhr.addEventListener("error", () => {
    option.onError(getError(action, option, xhr));
  });

  xhr.addEventListener("load", () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      return option.onError(getError(action, option, xhr));
    }
    option.onSuccess(xhr.response);
  });

  console.log("xhr open");
  xhr.open(option.method, action, true);
  xhr.responseType = "blob";

  if (option.withCredentials && "withCredentials" in xhr) {
    xhr.withCredentials = true;
  }

  const headers = option.headers || {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
  } else {
    for (const [key, value] of Object.entries(headers)) {
      if (isNil(value)) continue;
      xhr.setRequestHeader(key, String(value));
    }
  }

  xhr.send(formData);
  return xhr;
};
