"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWorkoutPlan = void 0;
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
var generatePlan_1 = require("./generatePlan");
Object.defineProperty(exports, "generateWorkoutPlan", { enumerable: true, get: function () { return generatePlan_1.generateWorkoutPlan; } });
//# sourceMappingURL=index.js.map