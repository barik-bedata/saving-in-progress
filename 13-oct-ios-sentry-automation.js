"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaHandler = void 0;
var axios_1 = require("axios");
/**
 * SentryToSlackAutomationIOS
 *
 * Daily iOS crash digest: Sentry -> Slack, 05:00 Europe/London.
 * Fully self-contained - shares nothing with the Android lambda, so the iOS
 * Sentry token, org, project and Slack channel can all differ from Android.
 *
 * Environment variables (read directly - the names below are exactly what
 * you set in Bitbucket, no renaming happens in serverless.yml):
 *   SENTRY_AUTH_TOKEN_IOS
 *   SENTRY_ORG_SLUG_IOS
 *   SENTRY_PROJECT_SLUG_IOS
 *   SLACK_WEBHOOK_URL_IOS
 *   SENTRY_BASE_URL_IOS   (optional)
 */
var PLATFORM_NAME = "iOS";
var PLATFORM_ICON = ":iphone:";
var TOP_ISSUE_COUNT = 5; // issues shown in the message
var ISSUE_FETCH_LIMIT = 100; // Sentry's per-page maximum
var DEFAULT_WINDOW_HOURS = 24; // scheduled runs; a local run can override it
var MAX_RETRIES = 3;
var REQUEST_TIMEOUT_MS = 10000;
/* ------------------------------------------------------------------ utils */
function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}
function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function londonPart(date, options) {
    var opts = { timeZone: "Europe/London" };
    for (var key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
            opts[key] = options[key];
        }
    }
    return new Intl.DateTimeFormat("en-GB", opts).format(date);
}
/** "07:34" - Python's %H:%M, but pinned to Europe/London instead of UTC. */
function hhmm(date) {
    var t = londonPart(date, { hour: "2-digit", minute: "2-digit", hour12: false });
    return t.indexOf("24:") === 0 ? "00:" + t.slice(3) : t;
}
/** "Sep 16 07:34" - Python's "%b %d %H:%M". */
function shortStamp(date, withYear) {
    if (withYear === void 0) { withYear = false; }
    var month = londonPart(date, { month: "short" }).replace(".", "").slice(0, 3);
    var day = londonPart(date, { day: "2-digit" });
    var time = hhmm(date);
    return withYear
        ? "".concat(month, " ").concat(day, " ").concat(time, ", ").concat(londonPart(date, { year: "numeric" }))
        : "".concat(month, " ").concat(day, " ").concat(time);
}
/** "2026-09-17 07:34:33" - Python's "%Y-%m-%d %H:%M:%S". */
function fullStamp(date) {
    var y = londonPart(date, { year: "numeric" });
    var m = londonPart(date, { month: "2-digit" });
    var d = londonPart(date, { day: "2-digit" });
    // `second: "2-digit"` alone is not zero-padded by every ICU build, so pad here.
    var sec = londonPart(date, { second: "2-digit" });
    var ss = sec.length < 2 ? "0" + sec : sec;
    return "".concat(y, "-").concat(m, "-").concat(d, " ").concat(hhmm(date), ":").concat(ss);
}
/** Python's get_date_range()["readable_range"]. */
function readableRange(start, end, hours) {
    var duration = hours > 24 && hours % 24 === 0 ? "".concat(hours / 24, " days") : "".concat(hours, " hours");
    return "Last ".concat(duration, " (").concat(shortStamp(start), " - ").concat(shortStamp(end, true), ")");
}
/* -------------------------------------------------------------- sentry api */
function config() {
    var authToken = process.env.SENTRY_AUTH_TOKEN_IOS;
    var orgSlug = process.env.SENTRY_ORG_SLUG_IOS;
    var projectSlug = process.env.SENTRY_PROJECT_SLUG_IOS;
    var webhookUrl = process.env.SLACK_WEBHOOK_URL_IOS;
    var apiBase = process.env.SENTRY_BASE_URL_IOS || "https://sentry.io/api/0";
    var missing = [];
    if (!authToken) {
        missing.push("SENTRY_AUTH_TOKEN_IOS");
    }
    if (!orgSlug) {
        missing.push("SENTRY_ORG_SLUG_IOS");
    }
    if (!projectSlug) {
        missing.push("SENTRY_PROJECT_SLUG_IOS");
    }
    if (!webhookUrl) {
        missing.push("SLACK_WEBHOOK_URL_IOS");
    }
    if (missing.length > 0) {
        var error = new Error("Missing required environment variables: ".concat(missing.join(", ")));
        error.isConfigError = true;
        throw error;
    }
    return { authToken: authToken, orgSlug: orgSlug, projectSlug: projectSlug, webhookUrl: webhookUrl, apiBase: apiBase };
}
function sentryRequest(endpoint, params) {
    return __awaiter(this, void 0, void 0, function () {
        var cfg, backoff, attempt, response, e_1, status, isLastAttempt, retryable, detail;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cfg = config();
                    backoff = 1000;
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 8];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 7]);
                    return [4 /*yield*/, axios_1.default.get("".concat(cfg.apiBase, "/").concat(endpoint), {
                            headers: { Authorization: "Bearer ".concat(cfg.authToken) },
                            params: params,
                            timeout: REQUEST_TIMEOUT_MS
                        })];
                case 3:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
                case 4:
                    e_1 = _a.sent();
                    status = e_1.response && e_1.response.status;
                    isLastAttempt = attempt === MAX_RETRIES - 1;
                    // Not worth retrying - the configuration itself is wrong.
                    if (status === 401 || status === 403) {
                        throw new Error("Sentry rejected SENTRY_AUTH_TOKEN_IOS (HTTP ".concat(status, ") on ").concat(endpoint));
                    }
                    if (status === 404) {
                        throw new Error("Sentry returned 404 on ".concat(endpoint, " - check SENTRY_ORG_SLUG_IOS and SENTRY_PROJECT_SLUG_IOS"));
                    }
                    retryable = status === 429 || !status || status >= 500;
                    if (!(retryable && !isLastAttempt)) return [3 /*break*/, 6];
                    console.warn("".concat(endpoint, " failed (").concat(status || e_1.message, "), retrying in ").concat(backoff, "ms"));
                    return [4 /*yield*/, sleep(backoff)];
                case 5:
                    _a.sent();
                    backoff *= 2;
                    return [3 /*break*/, 7];
                case 6:
                    detail = e_1.response && e_1.response.data ? JSON.stringify(e_1.response.data) : e_1.message;
                    throw new Error("Sentry request failed on ".concat(endpoint, " (HTTP ").concat(status || "network", "): ").concat(detail));
                case 7:
                    attempt++;
                    return [3 /*break*/, 1];
                case 8: throw new Error("Sentry request failed on ".concat(endpoint, " after ").concat(MAX_RETRIES, " attempts"));
            }
        });
    });
}
/**
 * Hourly event counts, aggregated server-side by Sentry.
 * Returns [[unixSeconds, count], ...].
 */
function getDailyStats(hours) {
    return __awaiter(this, void 0, void 0, function () {
        var cfg, until, since, data, points, totalEvents, hourly, i, count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cfg = config();
                    until = Math.floor(Date.now() / 1000);
                    since = until - (hours * 60 * 60);
                    return [4 /*yield*/, sentryRequest("projects/".concat(cfg.orgSlug, "/").concat(cfg.projectSlug, "/stats/"), {
                            stat: "received",
                            since: since,
                            until: until,
                            resolution: "1h"
                        })];
                case 1:
                    data = _a.sent();
                    points = (data || []);
                    totalEvents = 0;
                    hourly = [];
                    for (i = 0; i < points.length; i++) {
                        count = points[i][1] || 0;
                        totalEvents += count;
                        hourly.push({ hour: hours > 24 ? shortStamp(new Date(points[i][0] * 1000)) : hhmm(new Date(points[i][0] * 1000)), count: count });
                    }
                    return [2 /*return*/, { totalEvents: totalEvents, hourly: hourly }];
            }
        });
    });
}
/**
 * The organization endpoint supports arbitrary reporting windows. Always pass
 * the iOS project filter so other projects cannot enter this digest.
 */
function getIssues(hours) {
    return __awaiter(this, void 0, void 0, function () {
        var cfg, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cfg = config();
                    return [4 /*yield*/, sentryRequest("organizations/".concat(cfg.orgSlug, "/issues/"), {
                            project: cfg.projectSlug,
                            statsPeriod: "".concat(hours, "h"),
                            query: "is:unresolved",
                            sort: "freq",
                            limit: ISSUE_FETCH_LIMIT
                        })];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, (data || []).map(function (issue) {
                            return {
                                shortId: issue.shortId || "",
                                title: issue.title || "Unknown Error",
                                level: (issue.level || "error").toUpperCase(),
                                status: titleCase(issue.status || "unresolved"),
                                count: issue.count || "0",
                                userCount: issue.userCount || 0,
                                permalink: issue.permalink || "#"
                            };
                        })];
            }
        });
    });
}
/* ----------------------------------------------------------------- message */
function titleCase(text) {
    return text.replace(/\w\S*/g, function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}
function truncate(text, max) {
    return text.length > max ? text.slice(0, max) + "..." : text;
}
function hourlyBlock(hourly, hours) {
    var lines = [];
    for (var i = 0; i < hourly.length; i++) {
        if (hourly[i].count > 0) {
            lines.push("".concat(hourly[i].hour, ": ").concat(formatNumber(hourly[i].count), " events"));
        }
    }
    if (lines.length === 0) {
        return "No events in the last ".concat(hours, " hours! \uD83C\uDF89");
    }
    return lines.join("\n");
}
function issuesBlock(issues, hours) {
    if (issues.length === 0) {
        return "No major issues in the last ".concat(hours, " hours! \uD83C\uDF89");
    }
    var lines = [];
    var shown = issues.slice(0, TOP_ISSUE_COUNT);
    for (var i = 0; i < shown.length; i++) {
        var issue = shown[i];
        var events = parseInt(issue.count, 10) || 0;
        lines.push("".concat(i + 1, ". *<").concat(issue.permalink, "|").concat(truncate(issue.title, 60), ">*"));
        lines.push("   ".concat(formatNumber(events), " events \u2022 ").concat(formatNumber(issue.userCount), " users \u2022 ") +
            "".concat(issue.level, " \u2022 ").concat(issue.status));
    }
    return lines.join("\n");
}
function buildSlackMessage(stats, issues, hours) {
    var cfg = config();
    var now = new Date();
    var start = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    var range = readableRange(start, now, hours);
    var affectedUsers = 0;
    var totalErrors = 0;
    var fatalEvents = 0;
    for (var i = 0; i < issues.length; i++) {
        var events = parseInt(issues[i].count, 10) || 0;
        affectedUsers += issues[i].userCount || 0;
        if (issues[i].level === "ERROR" || issues[i].level === "FATAL") {
            totalErrors += events;
        }
        if (issues[i].level === "FATAL") {
            fatalEvents += events;
        }
    }
    // Busiest hour of the window - replaces Python's "Error Rate", which was
    // always ~100% because the events endpoint only ever returns error events.
    var peakHour = "n/a";
    var peakCount = 0;
    for (var i = 0; i < stats.hourly.length; i++) {
        if (stats.hourly[i].count > peakCount) {
            peakCount = stats.hourly[i].count;
            peakHour = "".concat(stats.hourly[i].hour, " (").concat(formatNumber(peakCount), ")");
        }
    }
    var issueCount = issues.length >= ISSUE_FETCH_LIMIT
        ? "".concat(ISSUE_FETCH_LIMIT, "+")
        : formatNumber(issues.length);
    var reportName = hours === 24 ? "Daily" : hours === 168 ? "Weekly" : "".concat(hours, "h");
    // Keep every section below Slack's text limit, including busy weekly reports.
    var breakdown = hourlyBlock(stats.hourly, hours).split("\n");
    var breakdownBlocks = [];
    for (var i = 0; i < breakdown.length; i += 40) {
        breakdownBlocks.push({
            type: "section",
            text: { type: "mrkdwn", text: "*:chart_with_upwards_trend: Hourly Breakdown (Events > 0):*\n```\n".concat(breakdown.slice(i, i + 40).join("\n"), "```") }
        });
    }
    return {
        text: ":bar_chart: Sentry ".concat(reportName, " iOS Report - ").concat(range),
        blocks: __spreadArray(__spreadArray([
            {
                type: "header",
                text: { type: "plain_text", text: ":bar_chart: ".concat(reportName, " ").concat(PLATFORM_NAME, " Report (Sentry)"), emoji: true }
            },
            {
                type: "context",
                elements: [
                    { type: "mrkdwn", text: ":calendar: ".concat(range, " \u2022 ").concat(PLATFORM_ICON, " ").concat(cfg.projectSlug) }
                ]
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: "*Total Events (".concat(hours, "h):*\n").concat(formatNumber(stats.totalEvents)) },
                    { type: "mrkdwn", text: "*Affected Users:*\n".concat(formatNumber(affectedUsers)) },
                    { type: "mrkdwn", text: "*Active Issues:*\n".concat(issueCount) },
                    { type: "mrkdwn", text: "*Peak Hour:*\n".concat(peakHour) }
                ]
            }
        ], breakdownBlocks, true), [
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: "*:rotating_light: Total Errors:*\n".concat(formatNumber(totalErrors)) },
                    { type: "mrkdwn", text: "*:skull: Fatal Events:*\n".concat(formatNumber(fatalEvents)) }
                ]
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: "*:fire: Top Issues (".concat(hours, "h):*\n").concat(issuesBlock(issues, hours)) }
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "Generated at ".concat(fullStamp(now), " \u2022 ") +
                            "<".concat(cfg.apiBase.replace("/api/0", ""), "/organizations/").concat(cfg.orgSlug, "/projects/").concat(cfg.projectSlug, "/|View in Sentry>")
                    }
                ]
            }
        ], false)
    };
}
function sendToSlack(message) {
    return __awaiter(this, void 0, void 0, function () {
        var cfg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cfg = config();
                    return [4 /*yield*/, axios_1.default.post(cfg.webhookUrl, message, {
                            headers: { "Content-Type": "application/json" },
                            timeout: REQUEST_TIMEOUT_MS
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* ----------------------------------------------------------------- handler */
var lambdaHandler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var requested, hours, stats, issues, e_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                config();
                requested = event && Number(event.hours);
                hours = requested > 0 && requested <= 2160 ? Math.floor(requested) : DEFAULT_WINDOW_HOURS;
                return [4 /*yield*/, getDailyStats(hours)];
            case 1:
                stats = _a.sent();
                return [4 /*yield*/, getIssues(hours)];
            case 2:
                issues = _a.sent();
                return [4 /*yield*/, sendToSlack(buildSlackMessage(stats, issues, hours))];
            case 3:
                _a.sent();
                console.log("".concat(PLATFORM_NAME, " report sent (").concat(hours, "h window): ").concat(stats.totalEvents, " events, ").concat(issues.length, " issues"));
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "".concat(PLATFORM_NAME, " report sent successfully!"),
                            windowHours: hours,
                            timestamp: new Date().toISOString()
                        })
                    }];
            case 4:
                e_2 = _a.sent();
                // Never post a report we could not build - a silently empty digest is
                // exactly what made the old Crashlytics lambda useless.
                console.error("".concat(PLATFORM_NAME, " report failed: ").concat(e_2.message));
                // Async Lambda invocations must throw so AWS records failed scheduled runs.
                if (event && event.scheduled === true) {
                    throw e_2;
                }
                // 400 for a bad configuration, 500 for anything else - same split as the
                // Python version's ValueError vs generic Exception branches.
                return [2 /*return*/, {
                        statusCode: e_2.isConfigError ? 400 : 500,
                        body: JSON.stringify({
                            error: e_2.message,
                            timestamp: new Date().toISOString()
                        })
                    }];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.lambdaHandler = lambdaHandler;
//# sourceMappingURL=sentryToSlackIOS.js.map
