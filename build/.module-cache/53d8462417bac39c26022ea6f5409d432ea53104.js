/** @jsx React.DOM */
var SECTOR_SEPARATOR = "#";
var Row = React.createClass({displayName: 'Row',
    render: function () {
        var cells = [];
        var firstCell;
        if (this.props.data.isDetail) {
            firstCell = React.DOM.td({key: this.props.data.col1}, this.props.data.col1);
        } else {
            firstCell =
                (
                    React.DOM.td({key: this.props.data.col1}, 
                        React.DOM.a({onClick: this.props.toggleHide.bind(null, this.props.data), className: "btn-link"}, 
                            React.DOM.strong(null, this.props.data.collapsed ? " +" : " -")
                        ), 
                    ' ', 
                        React.DOM.strong(null, this.props.data.col1)
                    )
                );
        }
        cells.push(firstCell);
        cells.push(React.DOM.td({key: this.props.data.col2}, this.props.data.col2));
        return (React.DOM.tr(null, cells));
    }
});
var Table = React.createClass({displayName: 'Table',
    getInitialState: function () {
        return {
            collapsedSectorPaths: []
        };
    },
    handleHide: function (sectorPath) {
        // TODO handle hide
    },
    handleUnhide: function (sectorPath) {
        // TODO handle unhide
    },
    handleToggleHide: function (summaryRow) {
        var newData = [];
        if (summaryRow.collapsed) {
            newData = this.handleUnhide(summaryRow.sectorPath);
        } else {
            newData = this.handleHide(summaryRow.sectorPath);
        }
        summaryRow.collapsed = !summaryRow.collapsed;
        this.setState({
            data: newData
        });
    },
    render: function () {
        var unhiddenRows = [];
        // create a array for hidden rows
        for (var i = 0; i < this.props.data.length; i++) {
            var data = this.props.data[i];
            if (shouldHide(data, this.props.collapsedSectorPaths))
                unhiddenRows.push(data);
        }
        // only show unhidden rows
        var rows = unhiddenRows.map(function (row) {
            return Row({data: row, key: generateRowKey(row), toggleHide: this.handleToggleHide});
        }, this);

        return (
            React.DOM.table({className: "table table-bordered table-condensed"}, 
                React.DOM.thead(null, 
                    React.DOM.tr(null, 
                        React.DOM.td(null, "col1"), 
                        React.DOM.td(null, "col2")
                    )
                ), 
                React.DOM.tbody(null, 
                rows
                )
            )
        );
    }
});

/* Utility Functions */
function sectorPathMatchesExactly(sp1, sp2) {
    if (sp1.length != sp2.length)
        return false;
    for (var i = 0; i < sp1.length; i++) {
        if (sp1[i] != sp2[i])
            return false;
    }
    return true;
}
function isSubSectorOf(subSP, superSP) {
    // lower length in SP means higher up on the chain
    if (subSP.length <= superSP.length)
        return false;
    for (var i = 0; i < superSP.length; i++) {
        if (subSP[i] != superSP[i])
            return false;
    }
    return true;
}
function shouldHide(data, sectorPathToHide) {
    var result = null;
    // hide all sub-sectors OR exact sector path matches - except for the summary row
    var sectorPath = data.sectorPath;
    if (isSubSectorOf(sectorPath, sectorPathToHide))
        result = true;
    else if (sectorPathMatchesExactly(sectorPath, sectorPathToHide) && data.isDetail)
        result = true;
    return result;
}
function generateRowKey(row) {
    // row key = sectorPath + values of the row
    var key = row.sectorPath.join(SECTOR_SEPARATOR);
    key += row.col1; // TODO generate a real key
}
/**
 * Compares sector path passed to all collapsed sectors to determine if one of the collapsed sectors is the given sector's ancestor
 * @param sectorPath [array] the sectorPath to perform comparison on
 * @param collapsedSectorPaths a map (object) where properties are string representation of the sectorPath considered to be collapsed
 * @returns {boolean}
 */
function areAncestorsCollapsed(sectorPath, collapsedSectorPaths) {
    var result = false;
    // true if sectorPaths is a subsector of the collapsedSectorPaths
    for (var sectorPathKey in collapsedSectorPaths) {
        if (collapsedSectorPaths.hasOwnProperty(sectorPathKey) && isSubSectorOf()) {

        }
    }
    return result;
}

/*
 * a row should be hidden if:
 *
 * its immediate sector is collapsed, and it is not the summary row of its immediate sector
 *
 * or any of its ancestor is collapsed
 *
 * otherwise it should be visible
 *
 * */