import { cloneDeep } from "lodash";

const defaultOptions = {
    templateAttributeName: "cm-template",
    payloadAttributeName: "cm-payload",
    idAttributeName: "cm-id"
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
        this.stagedInternalFnMap = {};
        this.internalFnMap = {};
        this.cleanedTemplates = {};

        // Merge any options the user passed in
        if (typeof options !== "undefined") {
            this.options = Object.assign(this.options, options);
        }
    }

    preloadBindings(ipcRenderer) {

        const createIpcBindings = () => {
            this.id = "";

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

                        // Save all attribute values for later-use when
                        // we call the callback defined for this context menu item
                        let attributes = this.selectedElement.attributes;
                        for (let i = 0; i < attributes.length; i++) {
                            if (attributes[i].name.indexOf(this.options.payloadAttributeName) >= 0) {
                                this.selectedElementAttributes[attributes[i].name.replace(`${this.options.payloadAttributeName}-`, "")] = attributes[i].value;
                            } else if (attributes[i].name.indexOf(this.options.idAttributeName) >= 0) {
                                this.id = attributes[i].value;
                            }
                        }

                        templateToSend = contextMenuTemplate;
                    }
                }

                // Send the request to the main process;
                // so the menu can get built
                ipcRenderer.send(contextMenuResponse, {
                    id: this.id,
                    params: args.params,
                    template: templateToSend
                });
            });

            ipcRenderer.on(contextMenuClicked, (event, args) => {

                // If we have an array of elements, mapping to the specific
                // function that should be called when the context menu item
                // is clicked will not work, because each element would have
                // the same html attributes.
                // In order to distinguish between which element of an array
                // was clicked, we use the 'this.id' property that was saved
                // when the element was right-clicked. This value becomes a 
                // unique identifier that we use to call the proper callback function.
                // If no id was defined, we simply fallback to existing behavior
                let isPrepend = args.id.indexOf("___") >= 0;

                if (isPrepend) {
                    let idSplit = args.id.split("___");

                    // Drop the command if the ids don't match
                    if (idSplit[0] !== this.id){
                        return;
                    }

                    if (typeof this.internalFnMap[args.id] === "undefined") {
                        this.internalFnMap[args.id] = this.stagedInternalFnMap[idSplit[1]];
                    }
                } else if (typeof this.internalFnMap[args.id] === "undefined") {
                    this.internalFnMap[args.id] = this.stagedInternalFnMap[args.id];
                }

                let payload = {
                    params: this.contextMenuParams,
                    attributes: this.selectedElementAttributes
                };
                this.internalFnMap[args.id](payload);
            });
        };
        createIpcBindings();

        return {
            onReceive: (id, func) => {
                this.stagedInternalFnMap[id] = func;
            },
            clearRendererBindings: () => {
                this.stagedInternalFnMap = {};
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

            // id prepend; if we have a list of common elements,
            // certain bindings may not work because each element would have
            // registered for the same event name. In these cases, prepend each
            // menu item with the unique id passed in so that each individual
            // component can respond appropriately to the context menu action
            let idPrepend = args.id ? `${args.id}___` : "";
            let cleanedTemplatesKey = `${idPrepend}${args.template}`;

            let contextMenu;
            if (args.template === null || typeof this.cleanedTemplates[cleanedTemplatesKey] === "undefined") {

                // Build our context menu based on our templates
                contextMenu = templates[args.template] ? cloneDeep(templates[args.template]) : [];
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
                                    id: `${idPrepend}${(contextMenu[i].id || contextMenu[i].label)}`
                                });
                            }
                        }
                    }
                }

                // Save this cleaned template, so we can re-use it
                this.cleanedTemplates[cleanedTemplatesKey] = contextMenu;
            }             
            contextMenu = this.cleanedTemplates[cleanedTemplatesKey];

            Menu.buildFromTemplate(contextMenu).popup(browserWindow);
        });
    }

    clearMainBindings(ipcMain) {
        this.cleanedTemplates = {};
        ipcMain.removeAllListeners(contextMenuResponse);
    }
}

const contextMenu = new ContextMenu();
export default contextMenu;