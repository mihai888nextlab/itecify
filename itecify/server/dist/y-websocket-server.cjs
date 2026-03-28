"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = require("ws");
var Y = __importStar(require("yjs"));
var syncProtocol = __importStar(require("y-protocols/sync"));
var awarenessProtocol = __importStar(require("y-protocols/awareness"));
var encoding = __importStar(require("lib0/encoding"));
var decoding = __importStar(require("lib0/decoding"));
var client_1 = require("@prisma/client");
var PORT = 1234;
var wss = new ws_1.WebSocketServer({ port: PORT });
var docs = new Map();
var prisma = new client_1.PrismaClient();
var messageSync = 0;
var messageAwareness = 1;
var messageAuth = 2;
var messageQueryAwareness = 3;
function getYDoc(projectId) {
    if (!docs.has(projectId)) {
        var doc = new Y.Doc();
        var awareness = new awarenessProtocol.Awareness(doc);
        loadState(projectId, doc);
        docs.set(projectId, { doc: doc, awareness: awareness });
    }
    return docs.get(projectId);
}
function loadState(projectId, doc) {
    return __awaiter(this, void 0, void 0, function () {
        var project, latestState, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, prisma.project.findUnique({
                            where: { id: projectId },
                        })];
                case 1:
                    project = _a.sent();
                    if (!project) {
                        console.log('Project not found, starting fresh:', projectId);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma.yjsState.findFirst({
                            where: { projectId: projectId },
                            orderBy: { createdAt: 'desc' },
                        })];
                case 2:
                    latestState = _a.sent();
                    if (latestState === null || latestState === void 0 ? void 0 : latestState.data) {
                        Y.applyUpdate(doc, Buffer.from(latestState.data));
                        console.log('State loaded for project:', projectId);
                    }
                    else {
                        console.log('No saved state found, starting fresh:', projectId);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.log('Error loading state:', error_1.message);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function saveState(projectId, doc) {
    return __awaiter(this, void 0, void 0, function () {
        var state, project, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    state = Y.encodeStateAsUpdate(doc);
                    return [4 /*yield*/, prisma.project.findUnique({
                            where: { id: projectId },
                        })];
                case 1:
                    project = _a.sent();
                    if (!project) return [3 /*break*/, 3];
                    return [4 /*yield*/, prisma.yjsState.create({
                            data: {
                                projectId: projectId,
                                data: Buffer.from(state),
                            },
                        })];
                case 2:
                    _a.sent();
                    console.log('State saved for project:', projectId);
                    return [3 /*break*/, 4];
                case 3:
                    console.log('Project not found, skipping state save:', projectId);
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    console.error('Failed to save state:', error_2.message);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
var connections = new Map();
var userAwarenessMap = new Map();
wss.on('connection', function (ws, req) {
    var url = new URL(req.url || '', "http://".concat(req.headers.host));
    var projectId = url.pathname.slice(1) || 'default';
    console.log("Client connected to project: ".concat(projectId));
    var _a = getYDoc(projectId), doc = _a.doc, awareness = _a.awareness;
    var clientId = doc.clientID;
    var conn = { ws: ws, doc: doc, awareness: awareness, projectId: projectId };
    connections.set(clientId.toString(), conn);
    var send = function (data) {
        if (ws.readyState === 1) {
            ws.send(data);
        }
    };
    var cleanupDuplicateAwareness = function () {
        var userIdToClientId = new Map();
        var clientIdToUserId = new Map();
        awareness.getStates().forEach(function (state, clientId) {
            var _a;
            if ((_a = state === null || state === void 0 ? void 0 : state.user) === null || _a === void 0 ? void 0 : _a.id) {
                var existingClientId = userIdToClientId.get(state.user.id);
                if (existingClientId !== undefined) {
                    awarenessProtocol.removeAwarenessStates(awareness, [existingClientId], null);
                }
                userIdToClientId.set(state.user.id, clientId);
                clientIdToUserId.set(clientId, state.user.id);
            }
        });
    };
    var awarenessChangeHandler = function (_a) {
        var added = _a.added, updated = _a.updated, removed = _a.removed;
        var changedClients = added.concat(updated, removed);
        var encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
        var message = encoding.toUint8Array(encoder);
        send(message);
        if (added.length > 0) {
            cleanupDuplicateAwareness();
        }
    };
    awareness.on('update', awarenessChangeHandler);
    var docUpdateHandler = function (update, origin) {
        var encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        send(encoding.toUint8Array(encoder));
    };
    doc.on('update', docUpdateHandler);
    ws.on('message', function (data) {
        try {
            var message = new Uint8Array(data);
            var decoder = decoding.createDecoder(message);
            var messageType = decoding.readVarUint(decoder);
            switch (messageType) {
                case messageSync: {
                    var encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, messageSync);
                    var syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);
                    if (encoding.length(encoder) > 1) {
                        send(encoding.toUint8Array(encoder));
                    }
                    if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
                        saveState(projectId, doc);
                    }
                    break;
                }
                case messageAwareness: {
                    var update = decoding.readVarUint8Array(decoder);
                    awarenessProtocol.applyAwarenessUpdate(awareness, update, null);
                    break;
                }
                case messageQueryAwareness: {
                    var encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, messageAwareness);
                    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys())));
                    send(encoding.toUint8Array(encoder));
                    break;
                }
            }
        }
        catch (error) {
            console.error('Message error:', error);
        }
    });
    ws.on('close', function () { return __awaiter(void 0, void 0, void 0, function () {
        var hasConnectionsForProject;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    connections.delete(clientId.toString());
                    awareness.off('update', awarenessChangeHandler);
                    doc.off('update', docUpdateHandler);
                    userAwarenessMap.forEach(function (value, userId) {
                        if (value.projectId === projectId && value.clientId === clientId) {
                            userAwarenessMap.delete(userId);
                        }
                    });
                    awarenessProtocol.removeAwarenessStates(awareness, [clientId], null);
                    console.log("Client disconnected from project: ".concat(projectId));
                    hasConnectionsForProject = Array.from(connections.values()).some(function (c) { return c.projectId === projectId; });
                    if (!!hasConnectionsForProject) return [3 /*break*/, 2];
                    return [4 /*yield*/, saveState(projectId, doc)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
    ws.on('error', function (error) {
        console.error('WebSocket error:', error);
    });
    {
        var encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeSyncStep1(encoder, doc);
        send(encoding.toUint8Array(encoder));
        var awarenessStates = awareness.getStates();
        if (awarenessStates.size > 0) {
            var encoder_1 = encoding.createEncoder();
            encoding.writeVarUint(encoder_1, messageAwareness);
            encoding.writeVarUint8Array(encoder_1, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())));
            send(encoding.toUint8Array(encoder_1));
        }
    }
});
console.log("Y-WebSocket server running on ws://localhost:".concat(PORT));
console.log('Waiting for connections...');
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log('\nShutting down...');
        docs.forEach(function (_, projectId) { return __awaiter(void 0, void 0, void 0, function () {
            var doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        doc = docs.get(projectId).doc;
                        return [4 /*yield*/, saveState(projectId, doc)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        process.exit(0);
        return [2 /*return*/];
    });
}); });
