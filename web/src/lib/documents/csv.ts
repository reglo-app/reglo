/** Enough to recognize a table: the file itself can be downloaded. */
export const CSV_PREVIEW_MAX_ROWS = 200;

/**
 * Text of a CSV file. Excel often saves in Windows-1252: without it, the
 * accents would be unreadable.
 */
export function decodeCsv(bytes: ArrayBuffer): string {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        return new TextDecoder("windows-1252").decode(bytes);
    }
}

/** The separator used most on the first line: ";" in France, or "," or tab. */
function findDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/, 1)[0];
    return [";", ",", "\t"].reduce((best, candidate) =>
        firstLine.split(candidate).length > firstLine.split(best).length
            ? candidate
            : best,
    );
}

/**
 * The first rows of a CSV file, with quoted values ("a;b", and "" for a
 * quote). Only ever shown as text.
 */
export function parseCsv(
    text: string,
    maxRows: number = CSV_PREVIEW_MAX_ROWS,
): { rows: string[][]; truncated: boolean } {
    const delimiter = findDelimiter(text);
    const rows: string[][] = [];
    let row: string[] = [];
    let value = "";
    let quoted = false;

    function endRow(): void {
        row.push(value);
        value = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (quoted) {
            if (char === '"' && text[i + 1] === '"') {
                value += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
            } else {
                value += char;
            }
        } else if (char === '"' && value === "") {
            quoted = true;
        } else if (char === delimiter) {
            row.push(value);
            value = "";
        } else if (char === "\n") {
            endRow();
            if (rows.length > maxRows) {
                return { rows: rows.slice(0, maxRows), truncated: true };
            }
        } else if (char !== "\r") {
            value += char;
        }
    }
    if (value !== "" || row.length > 0) endRow();

    return {
        rows: rows.slice(0, maxRows),
        truncated: rows.length > maxRows,
    };
}
