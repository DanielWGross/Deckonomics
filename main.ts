import { parse } from 'csv-parse/sync';
import * as fs from 'fs/promises';
import FuzzySearch from 'fuzzy-search';
import inquirer from 'inquirer';
import { default as autocomplete } from 'inquirer-autocomplete-standalone';
import { Rarity } from './generated/prisma';
import { TCGCSV } from './types/tcgcsv';
import { MenuOption, NewCard } from './types/types';
import { clearDatabase, createNewCards, createSet, getSetByGroupId } from './utils/db';
import { formatSet, printError, printMessage, printSetDetails } from './utils/displayUtils';

type TCGPlayerCard = {
    'TCGplayer Id': string;
    'Product Line': string;
    'Set Name': string;
    'Product Name': string;
    Title: string;
    Number: string;
    Rarity: string;
    Condition: string;
    'TCG Market Price': string;
    'TCG Direct Low': string;
    'TCG Low Price With Shipping': string;
    'TCG Low Price': string;
    'Total Quantity': string;
    'Add to Quantity': string;
    'TCG Marketplace Price': string;
    'Photo URL': string;
};

async function getTCGPlayerCards(csvPath: string): Promise<TCGPlayerCard[]> {
    try {
        const input = await fs.readFile(csvPath, 'utf-8');
        const records: TCGPlayerCard[] = parse(input, {
            columns: true,
            skip_empty_lines: true,
        });
        return records;
    } catch (error) {
        throw new Error('Error getting TCGplayer cards from CSV');
    }
}

async function fetchMTGSets(): Promise<TCGCSV.Set[]> {
    printMessage('\n=== Magic: The Gathering Set Search ===\n', 'yellow');

    try {
        const response = await fetch('https://tcgcsv.com/tcgplayer/1/groups');
        const data: TCGCSV.SetResponse = await response.json();
        return data.results;
    } catch (error) {
        throw new Error('Error fetching sets');
    }
}

async function fetchMTGCardsByGroupID(set: TCGCSV.Set): Promise<TCGCSV.Card[]> {
    printMessage(`\n=== Fetching Cards for ${set.name} (${set.abbreviation}) ===\n`, 'yellow');

    try {
        const url = `https://tcgcsv.com/tcgplayer/${set.categoryId}/${set.groupId}/products`;
        printMessage(`Fetching cards from ${url}`, 'gray');
        const response = await fetch(url);
        const data: TCGCSV.CardResponse = await response.json();
        return data.results;
    } catch (error) {
        printError('Error fetching cards', error);
        throw new Error('Error fetching cards');
    }
}

async function getSelectedSet(sets: TCGCSV.Set[]): Promise<TCGCSV.Set> {
    const fuzzySearch = new FuzzySearch(sets, ['name', 'abbreviation'], {
        caseSensitive: false,
        sort: true,
    });
    const selectedSet = await autocomplete({
        message: 'Search for a Magic: The Gathering Set:',
        source: async (input?: string) => {
            const searchTerm = input?.startsWith('/') ? input.slice(1) : input;
            const results = searchTerm ? fuzzySearch.search(searchTerm) : sets;
            return results.map((set: TCGCSV.Set) => formatSet(set));
        },
    });
    printSetDetails(selectedSet);
    return selectedSet;
}

async function showMainMenu(): Promise<MenuOption> {
    printMessage('\n=== Magic: The Gathering Tools ===\n');

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: 'List Sets', value: MenuOption.ListSets },
                { name: 'Add Set', value: MenuOption.AddSet },
                { name: 'Generate Set Data', value: MenuOption.GenerateSetData },
                { name: 'Generate Set Prices', value: MenuOption.GenerateSetPrices },
            ],
        },
    ]);

    return action;
}

function mapToCardEntity(
    tcgPlayerCards: TCGPlayerCard[],
    tcgCSVCards: TCGCSV.Card[],
    setId: number
): NewCard[] {
    const filteredTCGPlayerCards = tcgPlayerCards.filter((card: TCGPlayerCard) => {
        const condition = card.Condition.toLowerCase();
        return condition === 'near mint' || condition === 'near mint foil';
    });

    const cards: NewCard[] = filteredTCGPlayerCards.map((card: TCGPlayerCard) => {
        const newCard: NewCard = {
            tcgPlayerId: +card['TCGplayer Id'],
            setId: setId,
            productName: card['Product Name'],
            productId:
                tcgCSVCards.find((c: TCGCSV.Card) => c.name === card['Product Name'])?.productId ??
                0,
            productUrl:
                tcgCSVCards.find((c: TCGCSV.Card) => c.name === card['Product Name'])?.url ?? '',
            number: isNaN(+card['Number']) ? 0 : +card['Number'],
            rarity: card.Rarity as Rarity,
            condition: 'NM',
            printing: card['Condition'] === 'Near Mint' ? 'NORMAL' : 'FOIL',
        };

        return newCard;
    });

    return cards;
}

async function addCardsToDatabase(set: TCGCSV.Set): Promise<void> {
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Have you added the ${set.abbreviation.toLowerCase()}.csv in the data directory? `,
            default: false,
        },
    ]);

    if (!confirm) {
        printMessage('Please add the file and try again.', 'red');
        return process.exit(1);
    }

    const newSet = await createSet({
        groupId: set.groupId,
        name: set.name,
        abbreviation: set.abbreviation,
        isSupplemental: set.isSupplemental,
        publishedOn: new Date(set.publishedOn).toISOString(),
        modifiedOn: new Date(set.modifiedOn).toISOString(),
        categoryId: set.categoryId,
    });

    const tcgPlayerCards = await getTCGPlayerCards(
        `./deckonomics_data/${set.abbreviation.toLowerCase()}.csv`
    );
    const tcgCSVCards = await fetchMTGCardsByGroupID(set);
    const mappedCards = mapToCardEntity(tcgPlayerCards, tcgCSVCards, newSet.id);
    await createNewCards(mappedCards);

    const { confirmDelete } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmDelete',
            message: `Do you want me to delete the ${set.abbreviation.toLowerCase()}.csv in the data directory?`,
            default: true,
        },
    ]);

    if (confirmDelete) {
        try {
            await fs.unlink(`./deckonomics_data/${set.abbreviation.toLowerCase()}.csv`);
            printMessage(`Deleted ${set.abbreviation.toLowerCase()}.csv`, 'green');
        } catch (error) {
            throw new Error('Error deleting file:');
        }
    }
}

async function listSets(): Promise<void> {
    await clearDatabase();
    // Make a request to the TCGCSV API to get all the sets
    const allMTGSets = await fetchMTGSets();
    // Display all the sets to the user and capture the selected set
    const selectedSet = await getSelectedSet(allMTGSets);
    // Check if the set is already in the database
    const set = await getSetByGroupId(selectedSet.groupId);
    // If the set is not in the database we will add it
    if (!set) {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Have you already added this set to the database?',
                default: false,
            },
        ]);

        if (!confirm) {
            addCardsToDatabase(selectedSet);
        } else {
            // Create new set
            const newSet = await createSet({
                groupId: selectedSet.groupId,
                name: selectedSet.name,
                abbreviation: selectedSet.abbreviation,
                isSupplemental: selectedSet.isSupplemental,
                publishedOn: new Date(selectedSet.publishedOn).toISOString(),
                modifiedOn: new Date(selectedSet.modifiedOn).toISOString(),
                categoryId: selectedSet.categoryId,
            });

            printMessage('\nSuccessfully added set:', 'green');
            printSetDetails({
                name: newSet.name,
                abbreviation: newSet.abbreviation,
                publishedOn: newSet.publishedOn.toISOString(),
                modifiedOn: newSet.modifiedOn.toISOString(),
                isSupplemental: newSet.isSupplemental,
                categoryId: newSet.categoryId,
                groupId: newSet.groupId,
            });
            // Add the cards to the database
            await fetchMTGCardsByGroupID({
                groupId: selectedSet.groupId,
                name: selectedSet.name,
                abbreviation: selectedSet.abbreviation,
                isSupplemental: selectedSet.isSupplemental,
                publishedOn: new Date(selectedSet.publishedOn).toISOString(),
                modifiedOn: new Date(selectedSet.modifiedOn).toISOString(),
                categoryId: selectedSet.categoryId,
            });
        }
    } else {
        printMessage('\nSet already exists in database:', 'yellow');
    }
}

async function main(): Promise<void> {
    try {
        printMessage('\n=== Magic: The Gathering Set Search ===\n');
        printMessage('Use arrow keys to navigate, Enter to select\n', 'gray');

        const menuOption = await showMainMenu();

        switch (menuOption) {
            case MenuOption.AddSet:
                printMessage('\n== Add Set ==\n');
                // await addSet();
                break;
            case MenuOption.ListSets:
                printMessage('\n== List Sets ==\n');
                await listSets();
                break;
            case MenuOption.GenerateSetData:
                printMessage('\n== Generate Set Data ==\n');
                // const selectedSet = await getMTGSet();
                break;
            case MenuOption.GenerateSetPrices:
                printMessage('\n== Generate Set Prices ==\n');
                break;
            default:
                printError('Invalid option', 'Invalid option');
                process.exit(1);
        }
    } catch (error) {
        printError('Error fetching sets:', error);
        process.exit(1);
    }
}

main();
