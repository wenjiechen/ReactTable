/**
 * Construct Look and Feel object with instructions on how to display cell content
 * @param columnDef
 * @returns {{multiplier: number, roundTo: number, unit: string, alignment: string}}
 */
function buildLAFConfigObject(columnDef) {
    var formatInstructions = columnDef.formatInstructions;
    var result = {
        multiplier: 1,
        roundTo: 2,
        unit: null,
        alignment: getColumnAlignment(columnDef)
    };
    if (!formatInstructions)
        return result;
    var tokens = formatInstructions.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
        var key = tokens[i].split(":", 2)[0];
        result[key] = tokens[i].split(":", 2)[1];
    }
    return result;
}

/**
 * Compute cell alignment based on row attribute and column definition that intersects at a given cell
 * @param alignment the default alignment
 * @param row the row component of the cell of interest
 * @param columnDef the column definition associated with the cell of interest
 * @returns {*}
 */
function computeCellAlignment(alignment, row, columnDef) {
    // force right alignment for summary level numbers
    if (row[columnDef.colTag]) {
        if (!row.isDetail && (!isNaN(row[columnDef.colTag]) || !isNaN((row[columnDef.colTag]).replace(/,/g, ""))))
            return "right";
    }

    // default alignment
    return alignment;
}

function buildLabelForOmitCell(columnDef, row) {
    var displayInstructions = buildCellLookAndFeel(columnDef, row);
    return (
        <div className="rt-cell-omit-container">
            <div className='omit-content'>{displayInstructions.value}</div>
        </div>
    )
}

/**
 * Determines the style, classes and text formatting of cell content
 * given a column configuartion object and a row of data
 *
 * @param columnDef
 * @param row
 * @param isOmitted true do ommit
 * @returns { classes: {}, style: {}, value: {},omitted: boolean}
 */
function buildCellLookAndFeel(columnDef, row, isOmitted) {
    var results = {classes: {}, styles: {}, value: {}, omitted: false};
    var value = row[columnDef.colTag] || ""; // avoid undefined

    columnDef.formatConfig = columnDef.formatConfig != null ? columnDef.formatConfig : buildLAFConfigObject(columnDef);
    var formatConfig = columnDef.formatConfig;

    // invoke cell class callback
    if (columnDef.cellClassCallback)
        results.classes = columnDef.cellClassCallback(row);

    value = formatNumber(value, columnDef, formatConfig);

    // unit
    if (formatConfig.unit)
        value = value + " " + formatConfig.unit;

    // attach currency
    if (columnDef.format == "currency")
        value = "$" + value;

    if (columnDef.format === 'date')
        value = convertDateNumberToString(columnDef, value);

    if (isOmitted && isInt(columnDef.columnSize)  && value.length > columnDef.columnSize) {
        value = value.substring(0, columnDef.columnSize - 7) + ' ......';
        results.omitted = true;
    }

    // determine alignment
    results.styles.textAlign = computeCellAlignment(formatConfig.alignment, row, columnDef);
    results.styles.width = columnDef.text.length + "em";
    results.value = value;

    // show zero as blank
    if (formatConfig.showZeroAsBlank && results.value == 0)
        results.value = "";

    return results;
}

//check if a variable is integer or not
function isInt(data){
    return (data === parseInt(data, 10))
}

/**
 * return default column alignment given data type
 * @param columnDef
 * @returns {string}
 */
function getColumnAlignment(columnDef) {
    return (columnDef.format == "number" || columnDef.format == "currency") ? "right" : "left"
}

/**
 * takes a cell value and apply format instruction as needed
 * @param value
 * @param columnDef
 * @param formatConfig
 * @returns {*}
 */
function formatNumber(value, columnDef, formatConfig) {
    if (!isNaN(value) && (columnDef.format == "number" || columnDef.format == "currency")) {
        // multiplier
        value *= formatConfig.multiplier;
        // rounding
        value = value.toFixed(formatConfig.roundTo);
        // apply comma separator
        if (formatConfig.separator)
            value = applyThousandSeparator(value);
    }
    return value;
}
/**
 *
 * @param x
 * @returns {string}
 */
function applyThousandSeparator(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

