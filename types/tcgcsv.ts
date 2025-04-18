/* eslint-disable @typescript-eslint/no-namespace */
export namespace TCGCSV {
    export interface PresaleInfo {
        isPresale: boolean;
        releasedOn: string;
        note: string | null;
    }

    export interface ExtendedData {
        name: string;
        displayName: string;
        value: string;
    }

    export interface Card {
        productId: number;
        name: string;
        cleanName: string;
        imageUrl: string;
        categoryId: number;
        groupId: number;
        url: string;
        modifiedOn: string;
        imageCount: number;
        presaleInfo: PresaleInfo;
        extendedData: ExtendedData[];
    }

    export interface Set {
        groupId: number;
        name: string;
        abbreviation: string;
        isSupplemental: boolean;
        publishedOn: string;
        modifiedOn: string;
        categoryId: number;
    }

    export interface SetResponse {
        totalItems: number;
        success: boolean;
        errors: any[];
        results: Set[];
    }

    export interface CardResponse {
        totalItems: number;
        success: boolean;
        errors: any[];
        results: Card[];
    }
}
