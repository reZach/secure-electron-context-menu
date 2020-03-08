const defaultOptions = {
    templateAttributeName: "cm-template",
    payloadAttributeName: "cm-payload"
};

// Electron-specific; must match between main/renderer ipc
const contextMenuRequest = "ContextMenu-Request";
const contextMenuResponse = "ContextMenu-Response";
const contextMenuClicked = "ContextMenu-Clicked";

class ContextMenu {
    constructor(options) {
        this.options = defaultOptions;
        this.selectedElement = null;
        this.selectedElementAttributes = {};
        this.contextMenuParams = {};
        this.internalFnMap = {};
        this.templatesCleaned = {};

        // Merge any options the user passed in
        if (typeof options !== "undefined") {
            this.options = Object.assign(this.options, options);
        }
    }

    preloadBindings(ipcRenderer) {

        const createIpcBindings = () => {
            ipcRenderer.on(contextMenuRequest, (event, args) => {

                // Reset
                let templateToSend = null;
                this.selectedElement = null;
                this.selectedElementAttributes = {};
                this.contextMenuParams = args.params;

                // Grab the element where the user clicked
                this.selectedElement = document.elementFromPoint(args.params.x, args.params.y);
                if (this.selectedElement !== null) {

                    let contextMenuTemplate = this.selectedElement.getAttribute(this.options.templateAttributeName);
                    if (contextMenuTemplate !== "" && contextMenuTemplate !== null) {

                        let attributes = this.selectedElement.attributes;
                        for (let i = 0; i < attributes.length; i++) {
                            if (attributes[i].name.indexOf(this.options.payloadAttributeName) >= 0) {
                                this.selectedElementAttributes[attributes[i].name.replace(`${this.options.payloadAttributeName}-`, "")] = attributes[i].value;
                            }
                        }

                        templateToSend = contextMenuTemplate;
                    }
                }

                // Send the request to the main process;
                // so the menu can get built
                ipcRenderer.send(contextMenuResponse, {
                    params: args.params,
                    template: templateToSend
                });
            });

            ipcRenderer.on(contextMenuClicked, (event, args) => {
                if (typeof this.internalFnMap[args.id] !== "undefined") {
                    let payload = {
                        params: this.contextMenuParams,
                        payload: this.selectedElementAttributes
                    };
                    this.internalFnMap[args.id](payload);
                }
            });
        };
        createIpcBindings();

        return {
            onReceive: (id, func) => {
                this.internalFnMap[id] = func;
            },
            clearRendererBindings: () => {
                this.internalFnMap = {};
                this.contextMenuParams = {};
                ipcRenderer.removeAllListeners(contextMenuRequest);
                ipcRenderer.removeAllListeners(contextMenuClicked);
                createIpcBindings();
            }
        }
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

            let contextMenu;
            if (args.template === null || typeof this.templatesCleaned[args.template] === "undefined") {

                // Build our context menu based on our templates
                contextMenu = templates[args.template] || [];
                if (isDevelopment) {
                    contextMenu.push({
                        label: "Inspect element",
                        click: () => {
                            browserWindow.inspectElement(args.params.x, args.params.y);
                        }
                    });
                }

                if (args.template !== null) {

                    // For any menu items that don't have a role or click event,
                    // create one so we can tie back the click to the code!
                    for (let i = 0; i < contextMenu.length; i++) {
                        if (typeof contextMenu[i]["click"] === "undefined") {
                            contextMenu[i].click = function (event, window, webContents) {
                                browserWindow.webContents.send(contextMenuClicked, {
                                    id: contextMenu[i].id || contextMenu[i].label
                                });
                            }
                        }
                    }
                }

                this.templatesCleaned[args.template] = true;
            } else {
                contextMenu = templates[args.template];
            }

            Menu.buildFromTemplate(contextMenu).popup(browserWindow);
        });
    }

    clearMainBindings(ipcMain) {
        this.templatesCleaned = {};
        ipcMain.removeAllListeners(contextMenuResponse);
    }
}

const contextMenu = new ContextMenu();
export default contextMenu;