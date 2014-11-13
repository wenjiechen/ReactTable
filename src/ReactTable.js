/** @jsx React.DOM */

/**
 * The code for displaying/rendering data in a tabular format should be self-explanatory. What is worth noting is how
 * row grouping is handled. The approach involves identifying similar rows through the use of an array of strings called
 * 'sectorPath'. Rows with the same/similar sectorPath(s) are considered to be related. If two rows have the same sectorPath array
 * they belong to the same exact row group. If two rows partially share sectorPath are considered to share the same tree
 * (i.e. some head subset of their sectorPath array match)
 *
 * @author Erfang Chen
 */
var idCounter = 0;
var SECTOR_SEPARATOR = "#";

var ReactTable = React.createClass({

    getInitialState: ReactTableGetInitialState,

    handleSort: ReactTableHandleSort,
    handleAdd: ReactTableHandleAdd,
    handleRemove: ReactTableHandleRemove,
    handleToggleHide: ReactTableHandleToggleHide,
    handleGroupBy: ReacTableHandleGroupBy,
    handlePageClick: ReactTableHandlePageClick,
    handleRowSelect: ReactHandleRowSelect,
    handleCollapseAll: function () {
        var collapsedSectorPaths = getInitiallyCollapsedSectorPaths(this.state.data);
        this.setState({
            currentPage: 1,
            collapsedSectorPaths: collapsedSectorPaths,
            collapsedSectorKeys: extractSectorPathKeys(collapsedSectorPaths)
        });
    },
    handleExpandAll: function () {
        this.setState({
            collapsedSectorPaths: {},
            collapsedSectorKeys: []
        })
    },
    addColumn: function (columnDef, data) {
        this.state.columnDefs.push(columnDef);
        var state = {};
        state.columnDefs = this.state.columnDefs;
        if (data)
            state.data = deepCopyData(data);
        this.setState(state);
    },
    replaceData: function (data) {
        this.props.data = data;
        var initialStates = prepareTableData.call(this, this.props);
        this.state.selectedRows.summaryRows = [];
        this.setState({
            currentPage: 1,
            data: initialStates.data,
            selectedRows: this.state.selectedRows,
            collapsedSectorPaths: initialStates.collapsedSectorPaths,
            collapsedSectorKeys: initialStates.collapsedSectorKeys
        });
    },
    componentDidMount: function () {
        setTimeout(function () {
            adjustHeaders.call(this);
        }.bind(this));
        document.addEventListener('click', adjustHeaders.bind(this));
        window.addEventListener('resize', adjustHeaders.bind(this));
        var jqNode = $(this.getDOMNode());
        jqNode.find(".rt-scrollable").bind('scroll', function () {
            jqNode.find(".rt-headers").css({'overflow': 'auto'}).scrollLeft($(this).scrollLeft());
            jqNode.find(".rt-headers").css({'overflow': 'hidden'});
        });
        bindHeadersToMenu(jqNode);
    },
    componentWillUnmount: function () {
        window.removeEventListener('resize', adjustHeaders.bind(this));
    },
    componentDidUpdate: function(){
        adjustHeaders.call(this);
        bindHeadersToMenu($(this.getDOMNode()));
    },
    render: function () {
        var uncollapsedRows = [];
        // determine which rows are unhidden based on which sectors are collapsed
        for (var i = 0; i < this.state.data.length; i++) {
            var row = this.state.data[i];
            if (!shouldHide(row, this.state.collapsedSectorPaths, this.state.collapsedSectorKeys))
                uncollapsedRows.push(row);
        }
        // determine which unhidden rows to display on the current page
        var paginationAttr = getPageArithmetics(this, uncollapsedRows);
        var rowsToDisplay = uncollapsedRows.slice(paginationAttr.lowerVisualBound, paginationAttr.upperVisualBound + 1);

        var rows = rowsToDisplay.map(function (row) {
            var rowKey = this.props.rowKey;
            return (<Row
                data={row}
                key={generateRowKey(row, rowKey)}
                isSelected={isRowSelected.call(this, row)}
                onSelect={this.handleRowSelect}
                columnDefs={this.state.columnDefs}
                toggleHide={this.handleToggleHide}/>);
        }, this);

        var headers = buildHeaders(this);
        var footer = buildFooter(this, paginationAttr);

        var containerStyle = {};
        if (this.state.height && parseInt(this.state.height) > 0) {
            containerStyle.height = this.state.height;
        }
        return (
            <div id={this.state.uniqueId} className="rt-table-container">
                {headers}
                <div style={containerStyle} className="rt-scrollable">
                    <table className="rt-table">
                        <tbody>
                        {rows}
                        </tbody>
                    </table>
                </div>
                {footer}
            </div>
        );
    }
});
var Row = React.createClass({
    render: function () {
        var cells = [buildFirstCellForRow(this.props)];
        for (var i = 1; i < this.props.columnDefs.length; i++) {
            var columnDef = this.props.columnDefs[i];
            var lookAndFeel = buildCellLookAndFeel(columnDef, this.props.data);
            var cx = React.addons.classSet;
            var classes = cx(lookAndFeel.classes);
            cells.push(
                <td
                    className={classes}
                    style={lookAndFeel.styles}
                    key={columnDef.colTag}>
                    {lookAndFeel.value}
                </td>
            );
        }
        var cx = React.addons.classSet;
        var classes = cx({
            'selected': this.props.isSelected && this.props.data.isDetail,
            'summary-selected': this.props.isSelected && !this.props.data.isDetail
        });
        var styles = {
            "cursor": this.props.data.isDetail ? "pointer" : "inherit"
        };
        return (<tr onClick={this.props.onSelect.bind(null, this.props.data)} className={classes} style={styles}>{cells}</tr>);
    }
});
var PageNavigator = React.createClass({
    render: function () {
        var self = this;
        var cx = React.addons.classSet;
        var prevClass = cx({
            disabled: (this.props.activeItem == 1)
        });
        var nextClass = cx({
            disabled: (this.props.activeItem == this.props.numPages)
        });

        var items = this.props.items.map(function (item) {
            return (
                <li key={item} className={self.props.activeItem == item ? 'active' : ''}>
                    <a href="#" onClick={self.props.handleClick.bind(null, item)}>{item}</a>
                </li>
            )
        });
        return (
            <ul className={prevClass} className="pagination pull-right">
                <li className={nextClass}>
                    <a className={prevClass} href="#" onClick={this.props.handleClick.bind(null, this.props.activeItem - 1)}>&laquo;</a>
                </li>
                {items}
                <li className={nextClass}>
                    <a className={nextClass} href="#" onClick={this.props.handleClick.bind(null, this.props.activeItem + 1)}>&raquo;</a>
                </li>
            </ul>
        );
    }
});
var SummarizeControl = React.createClass({
    getInitialState: function () {
        return {
            userInputBuckets: ""
        }
    },
    handleChange: function (event) {
        this.setState({userInputBuckets: event.target.value});
    },
    render: function () {
        var table = this.props.table, columnDef = this.props.columnDef;
        var subMenuAttachment = columnDef.format == "number" || columnDef.format == "currency" ?
            (
                <div className="menu-item-input" onHover style={{"position": "absolute", "top": "0%", "left": "100%"}}>
                    <label>Enter Bucket(s)</label>
                    <input onChange={this.handleChange} placeholder="ex: 1,10,15"/>
                    <a onClick={table.handleGroupBy.bind(table, columnDef, this.state.userInputBuckets)} className="btn-link">Ok</a>
                </div>
            ) : null;
        return (
            <div
                onClick={subMenuAttachment == null ? table.handleGroupBy.bind(table, columnDef, null) : function () {
                } }
                style={{"position": "relative"}} className="menu-item menu-item-hoverable">
                <div>Summarize</div>
                {subMenuAttachment}
            </div>
        );
    }
});

function generateRowKey(row, rowKey) {
    var key;
    if (!row.isDetail) {
        key = generateSectorKey(row.sectorPath);
    }
    else if (rowKey)
        key = row[rowKey];
    else {
        key = row.rowCount;
    }
    return key;
}

function deepCopyData(data) {
    var rowCount = 0;
    return data.map(function (row) {
        var copy = {};
        for (var prop in row)
            if (row.hasOwnProperty(prop))
                copy[prop] = row[prop];
        copy.isDetail = true;
        copy.rowCount = rowCount;
        rowCount++;
        return copy;
    });
}

function computePageDisplayRange(currentPage, maxDisplayedPages) {
    // total number to allocate
    var displayUnitsLeft = maxDisplayedPages;
    // allocate to the left
    var leftAllocation = Math.min(Math.floor(displayUnitsLeft / 2), currentPage - 1);
    var rightAllocation = displayUnitsLeft - leftAllocation;
    return {
        start: currentPage - leftAllocation - 1,
        end: currentPage + rightAllocation - 1
    }
}

function adjustHeaders() {
    var id = this.state.uniqueId;
    var adjustedWideHeaders = false;
    var counter = 0;
    var headerElems = $("#" + id + " .rt-headers-container");
    var padding = parseInt(headerElems.first().find(".rt-header-element").css("padding-left"));
    padding += parseInt(headerElems.first().find(".rt-header-element").css("padding-right"));
    headerElems.each(function () {
        var currentHeader = $(this);
        var width = $('#' + id + ' .rt-table tr:first td:eq(' + counter + ')').outerWidth() - 1;
        if( counter == 0 && parseInt(headerElems.first().css("border-right")) == 1 ){
            width += 1;
        }
        var headerTextWidthWithPadding = currentHeader.find(".rt-header-anchor-text").width() + padding;
        if( currentHeader.width() > 0 && headerTextWidthWithPadding > currentHeader.width() + 1 ){
            $(this).width(headerTextWidthWithPadding);
            $("#" + id).find("tr").find("td:eq(" + counter + ")").css("min-width", (headerTextWidthWithPadding) + "px");
            adjustedWideHeaders = true;
        }
        currentHeader.width(width);
        counter++;
    });
    if( adjustedWideHeaders ){
        adjustHeaders.call(this);
    }
}

function getPageArithmetics(table, data) {
    var result = {};
    result.pageSize = table.props.pageSize || 50;
    result.maxDisplayedPages = table.props.maxDisplayedPages || 10;

    result.pageStart = 1;
    result.pageEnd = Math.ceil(data.length / result.pageSize);

    result.allPages = [];
    for (var i = result.pageStart; i <= result.pageEnd; i++) {
        result.allPages.push(i);
    }
    // derive the correct page navigator selectable pages from current / total pages
    result.pageDisplayRange = computePageDisplayRange(table.state.currentPage, result.maxDisplayedPages);

    result.lowerVisualBound = (table.state.currentPage - 1) * result.pageSize;
    result.upperVisualBound = Math.min(table.state.currentPage * result.pageSize - 1, data.length);

    return result;

}

function bindHeadersToMenu(node){
    node.find(".rt-headers-container").each(function(){
        var headerContainer = this;
        $(headerContainer).hover(function(){
            var headerPosition = $(headerContainer).position();
            if( headerPosition.left ){
                $(headerContainer).find(".rt-header-menu").css("left", headerPosition.left + "px");
            }
            if( headerPosition.right ){
                $(headerContainer).find(".rt-header-menu").css("right", headerPosition.right + "px");
            }
        });
    });
}

function uniqueId(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
};