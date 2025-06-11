"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printMessage = printMessage;
exports.printError = printError;
exports.formatSet = formatSet;
exports.printSetDetails = printSetDetails;
var chalk_1 = require("chalk");
function printMessage(message, color) {
    if (color === void 0) { color = 'cyan'; }
    console.log(chalk_1.default.bold[color](message));
}
function printError(message, error) {
    console.error(chalk_1.default.red("\n".concat(message)), error);
}
function formatSet(set) {
    return {
        value: set,
        name: "".concat(chalk_1.default.blue(set.name), " ").concat(chalk_1.default.gray("(".concat(set.abbreviation, ")"))),
        description: [
            chalk_1.default.gray('Published: ') + formatDate(set.publishedOn),
            chalk_1.default.gray('Modified: ') + formatDate(set.modifiedOn),
            chalk_1.default.gray('Supplemental: ') +
                (set.isSupplemental ? chalk_1.default.green('Yes') : chalk_1.default.red('No')),
        ].join(' | '),
    };
}
function printSetDetails(set) {
    printMessage('\n=== Selected Group Details ===\n');
    console.log(chalk_1.default.blue('Name:'), set.name);
    console.log(chalk_1.default.blue('Abbreviation:'), set.abbreviation);
    console.log(chalk_1.default.blue('Published:'), formatDate(set.publishedOn));
    console.log(chalk_1.default.blue('Modified:'), formatDate(set.modifiedOn));
    console.log(chalk_1.default.blue('Supplemental:'), set.isSupplemental ? chalk_1.default.green('Yes') : chalk_1.default.red('No'));
    console.log(chalk_1.default.gray('\nPress any key to exit...'));
}
function formatDate(dateString) {
    var date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
