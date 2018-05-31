import {Component, Input} from "@angular/core";
import {ITdDataTableColumn, ITdDataTableSortChangeEvent, TdDataTableService, TdDataTableSortingOrder} from '@covalent/core/data-table';
import {RemoteFile} from '../files/remote-file';
import {SelectionDialogComponent} from '../files/dialog/selection-dialog.component';
import {IPageChangeEvent} from '@covalent/core/paging';
import {SelectionService} from '../../api/services/selection.service';
import {HttpClient} from '@angular/common/http';
import {DataSource} from '../../api/models/datasource';
import {Node} from '../api/node';
import {StateService} from '@uirouter/angular';
import {MatDialog} from '@angular/material/dialog';
import {DatabaseObject, DatabaseObjectDescriptor} from './database-object';

@Component({
    selector: "data-source-select",
    styleUrls: ["js/feed-mgr/catalog/datasource/jdbc/jdbc.component.css"],
    templateUrl: "js/feed-mgr/catalog/datasource/jdbc/jdbc.component.html"
})
export class JdbcComponent {
    @Input()
    public datasource: DataSource;

    @Input()
    path: string;

    columns: ITdDataTableColumn[] = DatabaseObjectDescriptor.COLUMNS;
    sortBy = this.columns[0].name;
    sortOrder: TdDataTableSortingOrder = TdDataTableSortingOrder.Ascending;
    searchTerm: string = '';
    filteredFiles: DatabaseObject[] = [];
    filteredTotal = 0;
    fromRow: number = 1;
    currentPage: number = 1;
    pageSize: number = 50;
    selected: Node[] = [];
    selectAll: boolean = false;
    isParentSelected: boolean = false;
    selectedDescendantCounts: Map<string, number> = new Map<string, number>();

    paths: string[];
    files: DatabaseObject[] = [];
    private root: Node;
    private node: Node;
    private pathNodes: Node[] = [];

    constructor(private dataTableService: TdDataTableService, private http: HttpClient,
                private state: StateService, private selectionService: SelectionService,
                private dialog: MatDialog) {
    }

    public ngOnInit(): void {
        this.initNodes();
        const node = this.node;
        this.http.get("/proxy/v1/catalog/datasource/" + this.datasource.id + "/jdbc?path=" + encodeURIComponent(this.path), {})
            .subscribe((data: Array) => {
                console.log('received db objects', data);
                this.files = data.map(obj => new DatabaseObject(obj.name, obj.type));
                for (let file of this.files) {
                    node.addChild(new Node(file.name));
                }
                this.init();
            });
    }

    private init() {
        this.initIsParentSelected();
        this.initSelectedDescendantCounts();
        this.filter();
    }

    private initNodes() {
        console.log('init nodes');
        this.root = this.selectionService.get(this.datasource.id);
        if (this.root === undefined) {
            this.root = new Node(this.datasource.template.paths[0]);
            this.selectionService.set(this.datasource.id, this.root);
        }
        this.node = this.root.findFullPath(this.path);
        this.pathNodes.push(this.node);
        let parent = this.node.parent;
        while (parent) {
            this.pathNodes.push(parent);
            parent = parent.parent;
        }
        this.pathNodes = this.pathNodes.reverse();
    }

    private initSelectedDescendantCounts() {
        for (let node of this.node.children()) {
            this.selectedDescendantCounts.set(node.name, node.countSelectedDescendants());
        }
    }

    private initIsParentSelected() {
        this.isParentSelected = this.node.isAnyParentSelected();
    }

    rowClick(obj: DatabaseObject): void {
        console.log('row click, obj', obj);
        if (!obj.isColumn()) {
            this.browse(this.path + "/" + obj.name);
        }
    }

    browseTo(node: Node) {
        this.browse(node.path);
    }

    private browse(path: string) {
        this.state.go("catalog.datasource.jdbc", {path: encodeURIComponent(path)}, {notify: false, reload: false});
    }

    isChecked(fileName: string) {
        return this.isParentSelected || this.node.isChildSelected(fileName);
    }

    onToggleAll(): void {
        this.node.toggleAll(this.selectAll);
        this.init();
    }

    onToggleRow(event: any, file: RemoteFile): void {
        this.node.toggleChild(file.name, event.checked);
        this.init();
    }

    numberOfSelectedDescendants(fileName: string): number {
        return this.selectedDescendantCounts.get(fileName);
    }

    selectedHere() {
        return this.node.countSelectedChildren();
    }

    selectedTotal() {
        return this.root.countSelectedDescendants();
    }

    openSelectionDialog(): void {
        const dialogRef = this.dialog.open(SelectionDialogComponent, {
            data: {
                datasourceId: this.datasource.id
            }
        });

        dialogRef.afterClosed().subscribe(itemsWereRemoved => {
            if (itemsWereRemoved) {
                this.selectAll = false;
                this.init();
            }
        });
    }

    sort(sortEvent: ITdDataTableSortChangeEvent): void {
        this.sortBy = sortEvent.name;
        this.sortOrder = sortEvent.order === TdDataTableSortingOrder.Descending ? TdDataTableSortingOrder.Ascending : TdDataTableSortingOrder.Descending;
        this.filter();
    }

    search(searchTerm: string): void {
        this.searchTerm = searchTerm;
        this.filter();
    }

    page(pagingEvent: IPageChangeEvent): void {
        this.fromRow = pagingEvent.fromRow;
        this.currentPage = pagingEvent.page;
        this.pageSize = pagingEvent.pageSize;
        this.filter();
    }

    private filter(): void {
        let newData: any[] = this.files;
        let excludedColumns: string[] = this.columns
            .filter((column: ITdDataTableColumn) => {
                return ((column.filter === undefined && column.hidden === true) ||
                    (column.filter !== undefined && column.filter === false));
            }).map((column: ITdDataTableColumn) => {
                return column.name;
            });
        newData = this.dataTableService.filterData(newData, this.searchTerm, true, excludedColumns);
        this.filteredTotal = newData.length;
        newData = this.dataTableService.sortData(newData, this.sortBy, this.sortOrder);
        newData = this.dataTableService.pageData(newData, this.fromRow, this.currentPage * this.pageSize);
        this.filteredFiles = newData;
    }

}
