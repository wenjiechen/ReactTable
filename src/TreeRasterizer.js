/**
 * Converts the table state from a tree format to a array of rows for rendering
 * @param rootNode
 * @return {Array}
 */
function rasterizeTree(options, hasSubtotalBy, exportOutside, skipSubtotalRow, skipDetailRows, showHiddenSingleDetailRow) {
    var node = options.node, firstColumn = options.firstColumn;
    var flatData = [];

    if (!skipSubtotalRow) {
        node = _decorateRowData(node, firstColumn, hasSubtotalBy, exportOutside);
        flatData = node.display == false ? [] : [node.rowData];
    }

    if (node.ultimateChildren.length == 1 && options.hideSingleSubtotalChild && node.parent) {
        // if the subtotal level only has one child, hide this child. only show subtotal row;
        node.ultimateChildren[0].hiddenBySingleSubtotalRow = true;

        if (node.hasChild()) {
            //if the node is not leaf node, add plus sign
            node.noCollapseIcon = false;
        } else {
            node.noCollapseIcon = true;
        }
    }

    if (exportOutside) {
        if (node.children.length > 0)
            _rasterizeChildren(flatData, options, hasSubtotalBy, exportOutside, skipSubtotalRow, skipDetailRows, showHiddenSingleDetailRow);
        else if (!skipDetailRows)
            _rasterizeDetailRows(node, flatData, hasSubtotalBy, showHiddenSingleDetailRow);
    } else if (!node.collapsed) {
        if (node.children.length > 0)
            _rasterizeChildren(flatData, options, hasSubtotalBy, exportOutside, skipSubtotalRow, showHiddenSingleDetailRow);
        else
            _rasterizeDetailRows(node, flatData, hasSubtotalBy, showHiddenSingleDetailRow);
    }

    return flatData;
}

/**
 * when tree structure is changed, this function should be invoked
 */
function rasterizeTreeForRender() {
    addExtraColumnForSubtotalBy.call(this);

    const data = rasterizeTree({
        node: this.state.rootNode,
        firstColumn: this.state.columnDefs[0],
        hideSingleSubtotalChild: this.props.hideSingleSubtotalChild,
        isJaggedTree: this.props.isJaggedTree
    }, this.state.subtotalBy.length > 0);



    //those attributes of state is used by render() of ReactTable
    if (this.props.disableGrandTotal == true) {
        this.state.maxRows = data.length;
    } else {
        this.state.maxRows = data.length - 1;// maxRows is referenced later during event handling to determine upperVisualBound
        this.state.grandTotal = data.splice(0, 1).map(rowMapper, this);
    }
    this.state.rasterizedData = data;
    this.state.buildRasterizedData = false;
}

/*
 * ----------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------
 */

function _rasterizeChildren(flatData, options, hasSubtotalBy, exportOutside, skipSubtotalRow, skipDetailRows, showHiddenSingleDetailRow) {
    var node = options.node, firstColumn = options.firstColumn;
    var i, j, intermediateResult;
    for (i = 0; i < node.children.length; i++) {
        intermediateResult = rasterizeTree({
            hideSingleSubtotalChild: options.hideSingleSubtotalChild,
            isJaggedTree: options.isJaggedTree,
            node: node.children[i],
            firstColumn: firstColumn
        }, hasSubtotalBy, exportOutside, skipSubtotalRow, skipDetailRows, showHiddenSingleDetailRow);
        for (j = 0; j < intermediateResult.length; j++) {
            //
            if (!(intermediateResult[j].treeNode && intermediateResult[j].treeNode.hiddenByFilter))
                flatData.push(intermediateResult[j]);
        }
    }
}

/**
 *
 * @param node
 * @param flatData
 * @param hasSubtotalBy
 * @param showHiddenSingleDetailRow
 * @private
 */
function _rasterizeDetailRows(node, flatData, hasSubtotalBy, showHiddenSingleDetailRow) {
    for (var i = 0; i < node.ultimateChildren.length; i++) {
        var detailRow = node.ultimateChildren[i];

        if (showHiddenSingleDetailRow) {
            if (!detailRow.hiddenByFilter) {
                detailRow.sectorPath = node.rowData.sectorPath;
                detailRow.isDetail = true;
                detailRow.parent = node;
                detailRow.indexInParent = i;
                flatData.push(detailRow);
            }
        } else {
            //set to true only when has subtotaling
            var hiddenBySingleSubtotalRow = hasSubtotalBy && detailRow.hiddenBySingleSubtotalRow;
            if (!(detailRow.hiddenByFilter || hiddenBySingleSubtotalRow)) {
                detailRow.sectorPath = node.rowData.sectorPath;
                detailRow.isDetail = true;
                detailRow.parent = node;
                detailRow.indexInParent = i;
                flatData.push(detailRow);
            }
        }
    }
}

/**
 * enhances the `rowData` attribute of the give node with info
 * that will be useful for rendering/interactivity such as sectorPath
 */
function _decorateRowData(node, firstColumn, hasSubtotalBy, exportOutside) {
    node.rowData.sectorPath = node.getSectorPath();
    if (hasSubtotalBy) {
        node.rowData[firstColumn.colTag] = node.sectorTitle;
    }

    if (!exportOutside) {
        node.rowData.treeNode = node;
    }
    return node;
}