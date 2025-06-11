import { Card, CardSales, Set } from '../generated/prisma';

export type NewCard = Omit<Card, 'id' | 'createdAt' | 'updatedAt'>;

export type ChalkColor =
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white'
    | 'gray';

export const MenuOption = {
    AddSet: 'Add Set',
    ListSets: 'List Sets',
    GenerateSetData: 'Generate Set Data',
    GenerateSetPrices: 'Generate Set Prices',
    FetchSetPrices: 'Fetch Set Prices',
    DeleteCardSales: 'Delete Card Sales',
    GetTestCardSales: 'Get Test Card Sales',
} as const;

export type MenuOption = (typeof MenuOption)[keyof typeof MenuOption];

export type CardWithSales = Card & { sales: CardSales[] };
export type SetWithCards = Set & { cards: CardWithSales[] };
