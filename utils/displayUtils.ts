import chalk from 'chalk';
import { TCGCSV } from '../types/tcgcsv';
import { ChalkColor } from '../types/types';

export function printMessage(message: string, color: ChalkColor = 'cyan'): void {
    console.log(chalk.bold[color](message));
}

export function printError(message: string, error: unknown): void {
    console.error(chalk.red(`\n${message}`), error);
}

export function formatSet(set: TCGCSV.Set): {
    value: TCGCSV.Set;
    name: string;
    description: string;
} {
    return {
        value: set,
        name: `${chalk.blue(set.name)} ${chalk.gray(`(${set.abbreviation})`)}`,
        description: [
            chalk.gray('Published: ') + formatDate(set.publishedOn),
            chalk.gray('Modified: ') + formatDate(set.modifiedOn),
            chalk.gray('Supplemental: ') +
                (set.isSupplemental ? chalk.green('Yes') : chalk.red('No')),
        ].join(' | '),
    };
}

export function printSetDetails(set: TCGCSV.Set): void {
    printMessage('\n=== Selected Group Details ===\n');
    console.log(chalk.blue('Name:'), set.name);
    console.log(chalk.blue('Abbreviation:'), set.abbreviation);
    console.log(chalk.blue('Published:'), formatDate(set.publishedOn));
    console.log(chalk.blue('Modified:'), formatDate(set.modifiedOn));
    console.log(
        chalk.blue('Supplemental:'),
        set.isSupplemental ? chalk.green('Yes') : chalk.red('No')
    );
    console.log(chalk.gray('\nPress any key to exit...'));
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
