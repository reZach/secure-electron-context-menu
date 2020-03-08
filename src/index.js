const defaultOptions = {
    attributeName: "cm-option"
};

// Electron-specific; must match between main/renderer ipc
export const contextMenuRequest = "ContextMenu-Request";
export const contextMenuResponse = "ContextMenu-Response";

export default class ContextMenu {
    constructor(options) {
        this.options = defaultOptions;

        // Merge any options the user passed in
        if (typeof options !== "undefined") {
            this.options = Object.assign(this.options, options);
        }
    }

    preloadBindings(ipcRenderer) {
        ipcRenderer.on(contextMenuRequest, (event, args) => {

            // Grab the element where the user clicked
            let element = document.elementFromPoint(args.params.x, args.params.y);
            if (element !== null) {

                let contextMenuOption = element.getAttribute(this.options.attributeName);
                if (contextMenuOption !== "" && contextMenuOption !== null) {

                    // Send the request to the main process; so
                    // the menu can get built
                    ipcRenderer.send(contextMenuResponse, {
                        x: args.params.x,
                        y: args.params.y,
                        option: contextMenuOption
                    });
                }
            }
        });
    }

    mainBindings(ipcMain, browserWindow, Menu, isDevelopment, templates) {

        // Anytime a user right-clicks the browser window, send where they
        // clicked to the renderer process
        browserWindow.webContents.on("context-menu", (event, params) => {
            browserWindow.webContents.send(contextMenuRequest, {
                params
            });
        });

        ipcMain.on(contextMenuResponse, (IpcMainEvent, args) => {

            // Build our context menu based on our templates
            let contextMenu = templates[args.option];
            if (isDevelopment) {
                contextMenu.add({
                    label: "Inspect element",
                    click: () => {
                        mainWindow.inspectElement(args.x, args.y);
                    }
                });
            }

            Menu.buildFromTemplate(contextMenu).popup(browserWindow);
        });
    }
}