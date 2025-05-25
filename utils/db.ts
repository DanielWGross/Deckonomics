import * as fs from 'fs';
import * as path from 'path';
import type { Card, Set } from '../generated/prisma';
import { PrismaClient } from '../generated/prisma';
import { TCGCSV } from '../types/tcgcsv';
import { printError, printMessage } from './displayUtils';
import { NewCard } from '../types/types';

const prisma = new PrismaClient();

const errorLogDir = path.join(process.cwd(), 'deckonomics_logs');
if (!fs.existsSync(errorLogDir)) {
    fs.mkdirSync(errorLogDir);
}

function logErrorToFile(error: any, context: string): void {
    const timestamp = new Date().toISOString();
    const errorLogPath = path.join(errorLogDir, 'card_creation_errors.log');
    const errorMessage = `[${timestamp}] Error in ${context}: ${error instanceof Error ? error.message : String(error)}\n`;

    fs.appendFileSync(errorLogPath, errorMessage);
}

export const db = prisma;

export async function getAllCardsBySetId(setId: number): Promise<Card[]> {
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
