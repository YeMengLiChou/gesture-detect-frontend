export default {
  path: "/detect",
  redirect: "/detect/video",
  meta: {
    title: "检测识别"
  },
  children: [
    {
      path: "/detect/video",
      name: "DetectVideo",
      component: () => import("@/views/detect/video/index.vue"),
      meta: {
        title: "视频检测"
      }
    },
    {
      path: "/detect/pic",
      name: "DetetPicture",
      component: () => import("@/views/detect/video/index.vue"),
      meta: {
        title: "图片检测"
      }
    }
  ]
} satisfies RouteConfigsTable;
