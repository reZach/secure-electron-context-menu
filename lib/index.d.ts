export default contextMenu;
declare const contextMenu: ContextMenu;
declare class ContextMenu {
    constructor(options: any);
    options: any;
    selectedElement: any;
    selectedElementAttributes: {};
    contextMenuParams: {};
    stagedInternalFnMap: {};
    internalFnMap: {};
    cleanedTemplates: {};
    findContextElement(element: any, x: any, y: any): any;
    preloadBindings(ipcRenderer: any): {
        onReceive: (menuActionId: any, func: any, id: any) => void;
        clearRendererBindings: () => void;
    };
    id: any;
    mainBindings(ipcMain: any, browserWindow: any, Menu: any, isDevelopment: any, templates: any): void;
    clearMainBindings(ipcMain: any): void;
}
