import { onRequestPost as __api_auth_admin_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\auth\\admin.js"
import { onRequestPost as __api_auth_login_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\auth\\login.js"
import { onRequestPost as __api_auth_logout_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\auth\\logout.js"
import { onRequestGet as __api_auth_me_js_onRequestGet } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\auth\\me.js"
import { onRequestPost as __api_auth_signup_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\auth\\signup.js"
import { onRequestPost as __api_ai_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\ai.js"
import { onRequestGet as __api_feed_js_onRequestGet } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\feed.js"
import { onRequestDelete as __api_objectives_js_onRequestDelete } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\objectives.js"
import { onRequestGet as __api_objectives_js_onRequestGet } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\objectives.js"
import { onRequestPost as __api_objectives_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\objectives.js"
import { onRequestGet as __api_overview_js_onRequestGet } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\overview.js"
import { onRequestPost as __api_pull_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\pull.js"
import { onRequestPost as __api_pull_social_js_onRequestPost } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\pull-social.js"
import { onRequestGet as __api_report_js_onRequestGet } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\report.js"
import { onRequestGet as __api_social_js_onRequestGet } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\social.js"
import { onRequestGet as __api_stats_js_onRequestGet } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\stats.js"
import { onRequest as __api__middleware_js_onRequest } from "C:\\Users\\Mkhal\\commintelligence\\functions\\api\\_middleware.js"

export const routes = [
    {
      routePath: "/api/auth/admin",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_admin_js_onRequestPost],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_js_onRequestPost],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_js_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestGet],
    },
  {
      routePath: "/api/auth/signup",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_signup_js_onRequestPost],
    },
  {
      routePath: "/api/ai",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_js_onRequestPost],
    },
  {
      routePath: "/api/feed",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_feed_js_onRequestGet],
    },
  {
      routePath: "/api/objectives",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_objectives_js_onRequestDelete],
    },
  {
      routePath: "/api/objectives",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_objectives_js_onRequestGet],
    },
  {
      routePath: "/api/objectives",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_objectives_js_onRequestPost],
    },
  {
      routePath: "/api/overview",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_overview_js_onRequestGet],
    },
  {
      routePath: "/api/pull",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_pull_js_onRequestPost],
    },
  {
      routePath: "/api/pull-social",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_pull_social_js_onRequestPost],
    },
  {
      routePath: "/api/report",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_report_js_onRequestGet],
    },
  {
      routePath: "/api/social",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_social_js_onRequestGet],
    },
  {
      routePath: "/api/stats",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_stats_js_onRequestGet],
    },
  {
      routePath: "/api",
      mountPath: "/api",
      method: "",
      middlewares: [__api__middleware_js_onRequest],
      modules: [],
    },
  ]