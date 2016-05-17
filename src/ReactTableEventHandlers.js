/**
 * - STOP -
 *
 * please do not add too many states to the table. Per react.js documentation for best practices, any value derivable from props alone should NOT be stored as a state
 * but instead should be computed each time as the render() function.
 *
 * states are used to store info that cannot be inferred or derived from 'props', such as user interaction that occur within the component (collapsing a subtotal grouping / adding a column to sort)
 *
 */
function ReactTableGetInitialState() {

    var initialState = {
        uniqueId: uniqueId("table"), // i guess since this is randomly generated, it is not derivable from props alone
        currentPage: 1, // self-explanatory
        lastScrollTop: 0, // self-explanatory, this is the spiritual of currentPage for paginators

        // we shall consider any props that is modifiable through user interaction a state
        columnDefs: this.props.columnDefs,
        subtotalBy: this.props.subtotalBy,
        sortBy: this.props.sortBy,

        lowerVisualBound: 0,
        upperVisualBound: this.props.pageSize,
        extraStyle: {}, // TODO document use
        filterInPlace: {}, // TODO document use, but sounds like a legit state
        currentFilters: [], // TODO same as above
        searchInPlace: {}, // use a search box to filter a column

        rasterizedData: null, // table data for render
        buildRasterizedData: true, // when change table structure such as sort or subtotal, set this to true.
        hideSingleSubtotalChild: this.props.hideSingleSubtotalChild // if a subtotal level only has one child, hide the child
    };

    /**
     * justifiable as a state because its children contain sub-states like collapse/expanded or hide/un-hide
     * these states/sub-states arise from user interaction with this component, and not derivable from props or other states
     */
    initialState.rootNode = getRootNodeGivenProps(this.props, initialState);

    if (initialState.sortBy.length > 0)
        initialState.rootNode.sortNodes(convertSortByToFuncs(initialState.columnDefs, initialState.sortBy));

    addSubtotalTitleToRowData(initialState.rootNode);

    if (initialState.sortBy.length > 0) {
        var sortSubtotalByColumn = null;
        initialState.sortBy.forEach(function (sortSetting) {
            if (sortSetting.colTag === 'subtotalBy') {
                sortSubtotalByColumn = sortSetting;
            }
            ;
        });
        if (sortSubtotalByColumn) {
            initialState.sortBy.length = 0;
            initialState.sortBy.push(sortSubtotalByColumn);
            initialState.rootNode.sortTreeBySubtotals(initialState.subtotalBy, sortSubtotalByColumn.sortType);
        } else {
            initialState.rootNode.sortNodes(convertSortByToFuncs(initialState.columnDefs, initialState.sortBy));
        }
    }

    var selections = getInitialSelections(this.props.selectedRows, this.props.selectedSummaryRows);
    initialState.selectedDetailRows = selections.selectedDetailRows;
    initialState.selectedSummaryRows = selections.selectedSummaryRows;

    return initialState;
}

function getRootNodeGivenProps(props, initialState) {
    if (props.dataAsTree && props.dataAsTreeTitleKey) {
        props.data = [];
        return createNewNodeFromStrucutre(props.dataAsTree, props.dataAsTreeTitleKey);
    }
    else {
        return createNewRootNode(props, initialState);
    }
}

/**
 * add subtotal title for a subtotal row.
 */
function addSubtotalTitleToRowData(root) {
    if (root == null) {
        return;
    }

    root.rowData['subtotalBy'] = root.sectorTitle;
    root.children.forEach(function (child) {
        addSubtotalTitleToRowData(child);
    });
}

/**
 * to select a row, need to press ctrl and mouse click. this won't confuse double click a cell
 * if don't press ctrl but do a mouse click, all selected rows will be unselected.
 * @param selectedRow
 * @param event
 * @constructor
 */
function ReactTableHandleSelect(selectedRow, event) {
    if (event.shiftKey) {
        //press shift key
        var rowKey = this.props.rowKey;
        if (!rowKey || !selectedRow[rowKey])
            return;

        event.stopPropagation();
        event.preventDefault();
        if (!this.state.shiftKey) {
            this.state.shiftKey = {firstRow: selectedRow};
        } else if (!this.state.shiftKey.firstRow) {
            this.state.shiftKey.firstRow = selectedRow;
        } else {
            //add first click row to current selected row
            var parent = selectedRow.parent;
            var start = Math.min(this.state.shiftKey.firstRow.indexInParent, selectedRow.indexInParent);
            var end = Math.max(this.state.shiftKey.firstRow.indexInParent, selectedRow.indexInParent);
            this.state.selectedDetailRows = {};
            for (var i = start; i <= end; i++) {
                var row = parent.ultimateChildren[i];
                this.toggleSelectDetailRow(row[rowKey]);
            }
        }
        return;
    }

    if (!event.ctrlKey) {
        //don't press ctrl, clean selected rows
        var clearSelected = false;
        if (Object.keys(this.state.selectedDetailRows).length > 0) {
            this.state.selectedDetailRows = {};
            clearSelected = true;
        }

        if (Object.keys(this.state.selectedSummaryRows).length > 0) {
            this.state.selectedSummaryRows = {};
            clearSelected = true;
        }

        if (!this.state.shiftKey || this.state.shiftKey.firstRow) {
            this.state.shiftKey = {firstRow: null};
        }

        if (selectedRow.isDetail != null && selectedRow.isDetail == true) {
            if (this.props.onRowClickCallback) {
                this.props.onRowClickCallback(selectedRow, false);
            }
        }
        else if (this.props.onSummaryRowClickCallback) {
            this.props.onSummaryRowClickCallback(selectedRow, false);
        }

        if (clearSelected) {
            this.setState({});
        }
    } else {
        var rowKey = this.props.rowKey;
        if (!rowKey || !selectedRow[rowKey])
            return;

        if (selectedRow.isDetail != null && selectedRow.isDetail == true) {
            var state = this.toggleSelectDetailRow(selectedRow[rowKey]);
            if (this.props.onSelectCallback) {
                this.props.onSelectCallback(selectedRow, state);
            }
        }
        else {
            state = this.toggleSelectSummaryRow(generateSectorKey(selectedRow.sectorPath));
            if (this.props.onSummarySelectCallback) {
                this.props.onSummarySelectCallback(selectedRow, state);
            }
        }
    }
}

function ReactTableHandleColumnFilter(columnDefToFilterBy, e, dontSet) {
    columnDefToFilterBy.isFiltered = true;

    if (typeof dontSet !== "boolean")
        dontSet = undefined;

    if (Array.isArray(e)) {
        var filterData = e;
    } else {
        var target = $(e.target);
        if (target.is("span")) {
            filterData = target.text();
            if (filterData.lastIndexOf('......') == (filterData.length - 6)) {
                filterData = target.parent().find('.omit-content').text();
            }
        } else {
            filterData = target.children('span').text();
            if (filterData.lastIndexOf('......') == (filterData.length - 6)) {
                filterData = target.find('.omit-content').text();
            }
        }
    }

    if (!Array.isArray(filterData)) {
        if (columnDefToFilterBy.format == 'number') {
            filterData = [{eq: filterData}];
        } else {
            filterData = [filterData];
        }
    }

    var caseSensitive = !(this.props.filtering && this.props.filtering.caseSensitive === false);
    if (!dontSet) {
        // Find if this column has already been filtered.  If it is, we need to remove it before filtering again
        for (var i = 0; i < this.state.currentFilters.length; i++) {
            if (this.state.currentFilters[i].colDef === columnDefToFilterBy) {
                this.state.currentFilters.splice(i, 1);
                this.handleClearFilter(columnDefToFilterBy, true);
                break;
            }
        }
    }

    if (filterData.length != 0) {
        var customFilterer;
        if (this.props.filtering && this.props.filtering.customFilterer) {
            customFilterer = this.props.filtering.customFilterer;
        }
        this.state.rootNode.filterByColumn(columnDefToFilterBy, filterData, caseSensitive, customFilterer);
    }

    if (!dontSet) {
        buildFilterData.call(this, true);
        this.state.currentFilters.push({colDef: columnDefToFilterBy, filterText: filterData});

        refreshSubtotaledRowData(this.state.rootNode, this.state, -1);

        this.setState({
            rootNode: this.state.rootNode,
            currentFilters: this.state.currentFilters,
            buildRasterizedData: true
        });
    }

    this.props.afterFilterCallback && this.props.afterFilterCallback(columnDefToFilterBy, filterData);
}

/**
 * reset all treeNode hiddenByFilter to false
 * @param lrootNode
 */
function resetHiddenForAllTreeNodes(lrootNode) {
    lrootNode.hiddenByFilter = false;
    for (var i = 0; i < lrootNode.children.length; i++) {
        resetHiddenForAllTreeNodes(lrootNode.children[i]);
    }
}

function ReactTableHandleRemoveFilter(colDef, dontSet) {
    if (typeof dontSet !== "boolean")
        dontSet = undefined;

    // First clear out all filters
    for (var i = 0; i < this.state.rootNode.ultimateChildren.length; i++) {
        this.state.rootNode.ultimateChildren[i].hiddenByFilter = false;
    }
    resetHiddenForAllTreeNodes(this.state.rootNode);

    // Remove filter from list of current filters
    for (i = 0; i < this.state.currentFilters.length; i++) {
        if (this.state.currentFilters[i].colDef === colDef) {
            this.state.currentFilters.splice(i, 1);
            break;
        }
    }
    // Re-filter by looping through old filters
    for (i = 0; i < this.state.currentFilters.length; i++) {
        this.handleColumnFilter(this.state.currentFilters[i].colDef, this.state.currentFilters[i].filterText, true);
    }

    if (!dontSet) {
        buildFilterData.call(this, true);
        colDef.isFiltered = false;
        var fip = this.state.filterInPlace;
        delete fip[colDef.colTag];
        this.setState({
            filterInPlace: fip,
            rootNode: this.state.rootNode,
            currentFilters: this.state.currentFilters,
            buildRasterizedData: true
        });
    }

    this.props.afterFilterCallback && this.props.afterFilterCallback(colDef, []);
}

function ReactTableHandleRemoveAllFilters() {
    recursivelyClearFilters(this.state.rootNode);
    buildFilterData.call(this, true);
    //remove filter icon in header
    this.state.columnDefs.forEach(function (colDef) {
        colDef.isFiltered = false;
    });

    this.state.currentFilters.forEach(function (filter) {
        this.props.afterFilterCallback && this.props.afterFilterCallback(filter.colDef, []);
    }, this);

    // setState() does not immediately mutate this.state but creates a pending state transition.
    // Accessing this.state after calling this method can potentially return the existing value.
    // To avoid currentFilters haven't been changed when next time access it.
    this.state.currentFilters = [];
    this.setState({
        filterInPlace: {},
        rootNode: this.state.rootNode,
        buildRasterizedData: true
    });
}

function recursivelyClearFilters(node) {
    node.clearFilter();

    for (var i = 0; i < node.children.length; i++) {
        recursivelyClearFilters(node.children[i]);
    }

    if (!node.hasChild()) {
        for (var i = 0; i < node.ultimateChildren.length; i++) {
            node.ultimateChildren[i].hiddenByFilter = false;
        }
    }
}

function applyAllFilters() {
    for (var i = 0; i < this.state.currentFilters.length; i++) {
        this.handleColumnFilter(this.state.currentFilters[i].colDef, this.state.currentFilters[i].filterText, true);
    }
    this.setState({rootNode: this.state.rootNode});
}

function ReactTableHandleClearSubtotal(event) {
    event.stopPropagation();
    const newState = this.state;

    newState.buildRasterizedData = true;
    newState.currentPage = 1;
    newState.lowerVisualBound = 0;
    newState.upperVisualBound = this.props.pageSize;
    //newState.firstColumnLabel = buildFirstColumnLabel(this);
    /**
     * do not set subtotalBy or sortBy to blank array - simply pop all elements off, so it won't disrupt external reference
     */
    const subtotalBy = this.state.subtotalBy;
    while (subtotalBy.length > 0)
        subtotalBy.pop();
    newState.subtotalBy = subtotalBy;
    destorySubtrees(newState);
    //newState.rootNode = createNewRootNode(this.props, newState);
    /**
     * subtotaling destroys sort, so here we re-apply sort
     */
    if (this.state.sortBy.length > 0)
        newState.rootNode.sortNodes(convertSortByToFuncs(this.state.columnDefs, this.state.sortBy));

    applyAllFilters.call(this);
    this.setState(newState);
}

/**
 * check if a tree node needs to be hidden. if a tree node has no children to show, hide it.
 * @param lrootNode
 */
function hideTreeNodeWhenNoChildrenToShow(lrootNode) {
    if (lrootNode.hasChild()) {
        // Filter aggregations
        var allChildrenHidden = true;
        for (var i = 0; i < lrootNode.children.length; i++) {
            // Call recursively to filter leaf nodes first
            hideTreeNodeWhenNoChildrenToShow(lrootNode.children[i]);
            // Check to see if all children are hidden, then hide parent if so
            if (lrootNode.children[i].hiddenByFilter == false) {
                allChildrenHidden = false;
            }
        }
        lrootNode.hiddenByFilter = allChildrenHidden;
    } else {
        var hasAtLeastOneChildToShow = false;
        for (var j = 0; j < lrootNode.ultimateChildren.length; j++) {
            var uChild = lrootNode.ultimateChildren[j];
            if (uChild.hiddenByFilter == false) {
                hasAtLeastOneChildToShow = true;
                break;
            }
        }
        lrootNode.hiddenByFilter = !hasAtLeastOneChildToShow;
    }
};

function ReactTableHandleSubtotalBy(columnDef, partitions, event) {
    event.stopPropagation();
    const subtotalBy = this.state.subtotalBy || [];
    this.state.scrollToLeft = true;
    /**
     * determine if the subtotal operation require partitioning of the column values first
     */
    if (partitions != null && partitions != "" && columnDef) {

        if (columnDef.format == DATE_FORMAT && columnDef.formatInstructions != null) {
            var start = new Date('1/1/3002').getTime();
            var last = new Date('1/1/1002').getTime();
            var data = this.state.rootNode.ultimateChildren;
            for (var i = data.length - 1; i >= 0; i--) {
                tmp = data[i][columnDef.colTag];
                if (tmp < start) start = tmp;
                if (tmp > last) last = tmp;
            }

            if (partitions == WEEKLY || partitions == MONTHLY || partitions == DAILY || partitions == QUARTERLY || partitions == YEARLY) {
                columnDef.subtotalByRange = getParts(partitions, start, last);
            }
            else {     //Use partitions based on user input buckets
                var parts = [];
                var dates = partitions.split(",");
                for (i = 0; i < dates.length; i++) {
                    parts.push(new Date(dates[i]).getTime());
                }
                columnDef.subtotalByRange = parts;
            }
        }
        else {
            columnDef.subtotalByRange = partitionNumberLine(partitions);
        }

    }

    /**
     * make sure a valid column def is passed in
     */
    if (columnDef != null && columnDef.constructor.name != 'SyntheticMouseEvent')
        subtotalBy.push(columnDef);

    /**
     * extend the current state to derive new state after subtotal operation, then create a new rootNode
     */
    const newState = this.state;
    newState.currentPage = 1;
    newState.lowerVisualBound = 0;
    newState.upperVisualBound = this.props.pageSize;
    newState.subtotalBy = subtotalBy;
    newState.buildRasterizedData = true;
    buildSubtreeForNewSubtotal(newState, partitions);
    //newState.rootNode = createNewRootNode(this.props, newState);
    /**
     * subtotaling destroys sort, so here we re-apply sort
     */
    if (this.state.sortBy.length > 0)
        newState.rootNode.sortNodes(convertSortByToFuncs(this.state.columnDefs, this.state.sortBy));

    // subtotaling break filter also, because of create one more level of treeNode.
    // need hide treeNode which has no children to show
    if (this.state.currentFilters.length > 0) {
        hideTreeNodeWhenNoChildrenToShow(this.state.rootNode);
    }

    updateSubtoalColumnText.call(this);
    this.setState(newState);
}

function updateSubtoalColumnText() {
    if (this.state.columnDefs[0].colTag === 'subtotalBy') {
        this.state.columnDefs[0].text = getSubtotalHeaderLabel.call(this);
    }
}

//get parts for subtotalling of dates
function getParts(frequency, start, last) {
    var parts = [];
    var count = 1;
    var unit = "days";

    start = moment(start).startOf('day');
    if (frequency == MONTHLY) {
        unit = "months";
        count = 1;
        start = moment(start).startOf('month');
    } else if (frequency == QUARTERLY) {
        unit = "months";
        count = 3;
        start = moment(start).startOf('quarter');
    } else if (frequency == YEARLY) {
        unit = "years";
        count = 1;
        start = moment(start).startOf('year');
    } else if (frequency == WEEKLY) {
        unit = "days";
        count = 7;
        start = moment(start).startOf('isoWeek');
    }
    parts.push(start.unix() * 1000);

    while (start <= last) {
        start = moment(start).add(count, unit).unix() * 1000;
        parts.push(start);
    }
    return parts;
}

function ReactTableHandleAdd() {
    if (this.props.beforeColumnAdd)
        this.props.beforeColumnAdd(this);
}

function ReactTableHandleRemove(columnDefToRemove) {
    var loc = this.state.columnDefs.indexOf(columnDefToRemove);
    var newColumnDefs = [];
    for (var i = 0; i < this.state.columnDefs.length; i++) {
        if (i != loc)
            newColumnDefs.push(this.state.columnDefs[i]);
    }
    this.setState({
        columnDefs: newColumnDefs,
        buildRasterizedData: true
    });
    // TODO pass copies of these variables to avoid unintentional perpetual binding
    if (this.props.afterColumnRemove != null)
        this.props.afterColumnRemove(newColumnDefs, columnDefToRemove);
}

function ReactTableHandleToggleHide(summaryRow, event) {
    event.stopPropagation();
    summaryRow.treeNode.collapsed = !summaryRow.treeNode.collapsed;
    this.setState({buildRasterizedData: true});
}

function ReactTableHandlePageClick(page) {
    this.setState({
        currentPage: page
    });

}

/*
 * ----------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------
 */
function partitionNumberLine(partitions) {
    var i, stringBuckets, floatBuckets = [];
    stringBuckets = partitions.split(",");
    for (i = 0; i < stringBuckets.length; i++) {
        var floatBucket = parseFloat(stringBuckets[i]);
        if (!isNaN(floatBucket))
            floatBuckets.push(floatBucket);
        floatBuckets.sort(function (a, b) {
            return a - b;
        });
    }
    return floatBuckets;
}

function expandSubtotalLevelHelper(currentLevel, clickLevel, lTreeNode) {
    if (lTreeNode == null) {
        return;
    }
    if (currentLevel <= clickLevel) {
        lTreeNode.collapsed = false;
    } else {
        lTreeNode.collapsed = true;
    }
    for (var i = 0; i < lTreeNode.children.length; i++) {
        expandSubtotalLevelHelper(currentLevel + 1, clickLevel, lTreeNode.children[i]);
    }
}

/**
 * when click a subtotal level, expand this level
 * @param levelIndex
 * @param event
 */
function expandSubtotalLevel(levelIndex, event) {
    event.stopPropagation();
    expandSubtotalLevelHelper(0, levelIndex, this.state.rootNode);
    this.setState({buildRasterizedData: true});
}

/**
 * create subtotalBy information in header, e.g. [ tradeName -> tranType ]
 * @param table
 * @returns {string}
 */
function buildFirstColumnLabel(table) {
    if (table.state.subtotalBy.length > 0) {

        var subtotalHierarchy = [];
        table.state.subtotalBy.forEach(function (subtotalBy, index) {
            var column = table.state.columnDefs.filter(function (columnDef) {
                return columnDef.colTag === subtotalBy.colTag;
            });

            if (column.length == 0) {
                throw "subtotalBy field '" + subtotalBy.colTag + "' doesn't exist!";
            }

            var arrow = index == table.state.subtotalBy.length - 1 ? "" : " -> ";
            subtotalHierarchy.push(<span className="rt-header-clickable"
                                         onClick={expandSubtotalLevel.bind(table, index)}> {column[0].text}
                <span style={{color: 'white'}}>{arrow}</span>
            </span>);
        });

        return (
            <span > [ {subtotalHierarchy} ] </span>
        )
    } else {
        return table.state.columnDefs[0].text;
    }
}

function getInitialSelections(selectedRows, selectedSummaryRows) {
    var results = {selectedDetailRows: {}, selectedSummaryRows: {}};
    if (selectedRows != null) {
        for (var i = 0; i < selectedRows.length; i++)
            results.selectedDetailRows[selectedRows[i]] = 1;
    }
    if (selectedSummaryRows != null) {
        for (var i = 0; i < selectedSummaryRows.length; i++)
            results.selectedSummaryRows[selectedSummaryRows[i]] = 1;
    }
    return results;
}
