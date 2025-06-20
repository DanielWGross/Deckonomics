import * as fs from 'fs';
import * as path from 'path';
import type { Card, CardSales, Set } from '../generated/prisma';
import { PrismaClient } from '../generated/prisma';
import { TCGCSV } from '../types/tcgcsv';
import { printError, printMessage } from './displayUtils';
import { NewCard, SetWithCards, CardWithSales } from '../types/types';

const prisma = new PrismaClient();

const errorLogDir = path.join(process.cwd(), 'deckonomics_logs');
if (!fs.existsSync(errorLogDir)) {
    fs.mkdirSync(errorLogDir);
}

function logErrorToFile(error: unknown, context: string): void {
    const timestamp = new Date().toISOString();
    const errorLogPath = path.join(errorLogDir, 'card_creation_errors.log');
    const errorMessage = `[${timestamp}] Error in ${context}: ${error instanceof Error ? error.message : String(error)}\n`;

    fs.appendFileSync(errorLogPath, errorMessage);
    fs.appendFileSync(errorLogPath, '\n-------------------------------\n');
}

export const db = prisma;

export async function getSetWithCardsByGroupId(groupId: number): Promise<SetWithCards | undefined> {
    const set = await prisma.set.findUnique({
        where: { groupId },
        include: { cards: { include: { sales: true } } },
    });

    if (!set) {
        return undefined;
    }

    return set;
}

export async function getAllCardsByGroupId(groupId: number): Promise<SetWithCards | undefined> {
    const set = await prisma.set.findUnique({
        where: { groupId },
        include: {
            cards: {
                include: {
                    sales: true,
                },
            },
        },
    });

    if (!set) {
        return undefined;
    }

    return set;
}

export async function getCardsWithMoreThan25Sales(): Promise<CardWithSales[]> {
    const cards = await prisma.card.findMany({
        where: {
            sales: {
                some: {}, // at least one sale, but we will filter by count below
            },
        },
        include: {
            sales: true,
        },
    });

    // Filter in JS since Prisma does not support having/count in where yet
    const filteredCards = cards.filter((card) => card.sales.length > 25);
    // Sort the filtered cards array so the ones with the most sales come first
    filteredCards.sort((a, b) => b.sales.length - a.sales.length);
    return filteredCards;
}

export async function getTop10CardsByRecentSales(): Promise<
    (Card & { _count: { sales: number } })[]
> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cards = await prisma.card.findMany({
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
    });

    return cards;
}

export async function getAllCardsById(setId: number): Promise<Card[]> {
    return prisma.card.findMany({
        where: {
            setId,
        },
    });
}

export async function getAllSets(): Promise<Set[]> {
    return prisma.set.findMany({
        orderBy: {
            publishedOn: 'desc',
        },
    });
}

export async function getSetByGroupId(groupId: number): Promise<Set | null> {
    return prisma.set.findUnique({
        where: { groupId },
    });
}

export async function deleteSet(groupId: number): Promise<void> {
    await prisma.set.delete({
        where: { groupId },
    });
}

export async function getCardSalesByCardId(cardId: number): Promise<CardSales[]> {
    return prisma.cardSales.findMany({
        where: { cardId },
    });
}

export async function deleteCardSales(): Promise<void> {
    await prisma.cardSales.deleteMany();
}

export async function createSet(set: TCGCSV.Set): Promise<Set> {
    return prisma.set.create({
        data: {
            groupId: set.groupId,
            name: set.name,
            abbreviation: set.abbreviation,
            isSupplemental: set.isSupplemental,
            publishedOn: new Date(set.publishedOn),
            modifiedOn: new Date(set.modifiedOn),
            categoryId: set.categoryId,
        },
    });
}

export async function createCardSales(card: {
    orderDate: string;
    shippingPrice: number;
    purchasePrice: number;
    quantity: number;
    id: number;
}): Promise<CardSales | null> {
    try {
        return await prisma.cardSales.create({
            data: {
                orderDate: new Date(card.orderDate),
                shippingPrice: card.shippingPrice,
                purchasePrice: card.purchasePrice,
                quantity: card.quantity,
                card: {
                    connect: { id: card.id },
                },
            },
        });
    } catch (error: unknown) {
        // If the error is a unique constraint violation, we'll just skip it
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            // logErrorToFile(error, `Creating card sales for card ${card.id} at ${card.orderDate}`);
            return null;
        }
        // For any other error, we should log it and rethrow
        logErrorToFile(error, `Creating card sales for card ${card.id} at ${card.orderDate}`);
        throw error;
    }
}

export async function createNewCards(cards: NewCard[]): Promise<void> {
    for (const card of cards) {
        try {
            await prisma.card.create({
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
            });
        } catch (error) {
            const errorContext = `Creating card ${card.productName} (Product ID: ${card.productId}) (Number: ${card.number})`;
            printError(`Error ${errorContext}:`, error);
            logErrorToFile(error, errorContext);
        }
    }
}

export async function clearDatabase(): Promise<void> {
    try {
        await prisma.card.deleteMany();
        await prisma.set.deleteMany();
        printMessage('Database cleared successfully', 'green');
    } catch (error) {
        printError('Error clearing database:', error);
        logErrorToFile(error, 'Clearing database');
        throw error;
    }
}

process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma;
