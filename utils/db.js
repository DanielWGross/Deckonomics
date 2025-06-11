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
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getSetWithCardsByGroupId = getSetWithCardsByGroupId;
exports.getAllCardsByGroupId = getAllCardsByGroupId;
exports.getCardsWithMoreThan25Sales = getCardsWithMoreThan25Sales;
exports.getTop10CardsByRecentSales = getTop10CardsByRecentSales;
exports.getAllCardsById = getAllCardsById;
exports.getAllSets = getAllSets;
exports.getSetByGroupId = getSetByGroupId;
exports.deleteSet = deleteSet;
exports.getCardSalesByCardId = getCardSalesByCardId;
exports.deleteCardSales = deleteCardSales;
exports.createSet = createSet;
exports.createCardSales = createCardSales;
exports.createNewCards = createNewCards;
exports.clearDatabase = clearDatabase;
var fs = require("fs");
var path = require("path");
var prisma_1 = require("../generated/prisma");
var displayUtils_1 = require("./displayUtils");
var prisma = new prisma_1.PrismaClient();
var errorLogDir = path.join(process.cwd(), 'deckonomics_logs');
if (!fs.existsSync(errorLogDir)) {
    fs.mkdirSync(errorLogDir);
}
function logErrorToFile(error, context) {
    var timestamp = new Date().toISOString();
    var errorLogPath = path.join(errorLogDir, 'card_creation_errors.log');
    var errorMessage = "[".concat(timestamp, "] Error in ").concat(context, ": ").concat(error instanceof Error ? error.message : String(error), "\n");
    fs.appendFileSync(errorLogPath, errorMessage);
    fs.appendFileSync(errorLogPath, '\n-------------------------------\n');
}
exports.db = prisma;
function getSetWithCardsByGroupId(groupId) {
    return __awaiter(this, void 0, void 0, function () {
        var set;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.set.findUnique({
                        where: { groupId: groupId },
                        include: { cards: { include: { sales: true } } },
                    })];
                case 1:
                    set = _a.sent();
                    if (!set) {
                        return [2 /*return*/, undefined];
                    }
                    return [2 /*return*/, set];
            }
        });
    });
}
function getAllCardsByGroupId(groupId) {
    return __awaiter(this, void 0, void 0, function () {
        var set;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.set.findUnique({
                        where: { groupId: groupId },
                        include: {
                            cards: {
                                include: {
                                    sales: true,
                                },
                            },
                        },
                    })];
                case 1:
                    set = _a.sent();
                    if (!set) {
                        return [2 /*return*/, undefined];
                    }
                    return [2 /*return*/, set];
            }
        });
    });
}
function getCardsWithMoreThan25Sales() {
    return __awaiter(this, void 0, void 0, function () {
        var cards, filteredCards;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.card.findMany({
                        where: {
                            sales: {
                                some: {}, // at least one sale, but we will filter by count below
                            },
                        },
                        include: {
                            sales: true,
                        },
                    })];
                case 1:
                    cards = _a.sent();
                    filteredCards = cards.filter(function (card) { return card.sales.length > 25; });
                    // Sort the filtered cards array so the ones with the most sales come first
                    filteredCards.sort(function (a, b) { return b.sales.length - a.sales.length; });
                    return [2 /*return*/, filteredCards];
            }
        });
    });
}
function getTop10CardsByRecentSales() {
    return __awaiter(this, void 0, void 0, function () {
        var sevenDaysAgo, cards;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return [4 /*yield*/, prisma.card.findMany({
                            where: {
                                sales: {
                                    some: {
                                        orderDate: {
                                            gte: sevenDaysAgo,
                                        },
                                    },
                                },
                            },
                            include: {
                                _count: {
                                    select: {
                                        sales: {
                                            where: {
                                                orderDate: {
                                                    gte: sevenDaysAgo,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            orderBy: {
                                sales: {
                                    _count: 'desc',
                                },
                            },
                            take: 10,
                        })];
                case 1:
                    cards = _a.sent();
                    return [2 /*return*/, cards];
            }
        });
    });
}
function getAllCardsById(setId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.card.findMany({
                    where: {
                        setId: setId,
                    },
                })];
        });
    });
}
function getAllSets() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.set.findMany({
                    orderBy: {
                        publishedOn: 'desc',
                    },
                })];
        });
    });
}
function getSetByGroupId(groupId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.set.findUnique({
                    where: { groupId: groupId },
                })];
        });
    });
}
function deleteSet(groupId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.set.delete({
                        where: { groupId: groupId },
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getCardSalesByCardId(cardId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.cardSales.findMany({
                    where: { cardId: cardId },
                })];
        });
    });
}
function deleteCardSales() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.cardSales.deleteMany()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createSet(set) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.set.create({
                    data: {
                        groupId: set.groupId,
                        name: set.name,
                        abbreviation: set.abbreviation,
                        isSupplemental: set.isSupplemental,
                        publishedOn: new Date(set.publishedOn),
                        modifiedOn: new Date(set.modifiedOn),
                        categoryId: set.categoryId,
                    },
                })];
        });
    });
}
function createCardSales(card) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma.cardSales.create({
                            data: {
                                orderDate: new Date(card.orderDate),
                                shippingPrice: card.shippingPrice,
                                purchasePrice: card.purchasePrice,
                                quantity: card.quantity,
                                card: {
                                    connect: { id: card.id },
                                },
                            },
                        })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    // If the error is a unique constraint violation, we'll just skip it
                    if (error_1 && typeof error_1 === 'object' && 'code' in error_1 && error_1.code === 'P2002') {
                        // logErrorToFile(error, `Creating card sales for card ${card.id} at ${card.orderDate}`);
                        return [2 /*return*/, null];
                    }
                    // For any other error, we should log it and rethrow
                    logErrorToFile(error_1, "Creating card sales for card ".concat(card.id, " at ").concat(card.orderDate));
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createNewCards(cards) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, cards_1, card, error_2, errorContext;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _i = 0, cards_1 = cards;
                    _a.label = 1;
                case 1:
                    if (!(_i < cards_1.length)) return [3 /*break*/, 6];
                    card = cards_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, prisma.card.create({
                            data: {
                                tcgPlayerId: card.tcgPlayerId,
                                productName: card.productName,
                                productId: card.productId,
                                productUrl: card.productUrl,
                                number: card.number,
                                rarity: card.rarity,
                                condition: card.condition,
                                printing: card.printing,
                                set: {
                                    connect: { id: card.setId },
                                },
                            },
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    errorContext = "Creating card ".concat(card.productName, " (Product ID: ").concat(card.productId, ") (Number: ").concat(card.number, ")");
                    (0, displayUtils_1.printError)("Error ".concat(errorContext, ":"), error_2);
                    logErrorToFile(error_2, errorContext);
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function clearDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, prisma.card.deleteMany()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, prisma.set.deleteMany()];
                case 2:
                    _a.sent();
                    (0, displayUtils_1.printMessage)('Database cleared successfully', 'green');
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    (0, displayUtils_1.printError)('Error clearing database:', error_3);
                    logErrorToFile(error_3, 'Clearing database');
                    throw error_3;
                case 4: return [2 /*return*/];
            }
        });
    });
}
process.on('beforeExit', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
exports.default = prisma;
